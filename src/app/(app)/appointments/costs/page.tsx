import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, TrendingUp, Wallet, X } from "lucide-react";
import { requireFamilyContext, listAppointmentCosts, listCareGroups } from "@/lib/queries";
import { byGroup, byMonth, estimateRemaining, totalsOf, type CostItem } from "@/lib/costs";
import { baht } from "@/lib/money";
import { monthKeyLabel, monthKeyShort } from "@/lib/format";
import { can } from "@/lib/authz";
import { cn } from "@/lib/cn";
import { CostEditor } from "@/components/costs/cost-editor";
import {
  GroupDot,
  GroupFilter,
  LinkTabs,
  MissingNote,
  Money,
  SummaryStat,
  TotalsHeader,
} from "@/components/costs/bits";

export const metadata = { title: "ค่าใช้จ่ายนัดหมาย · Pre Care" };

type Search = { view?: string; group?: string; month?: string };

const VIEWS = ["list", "month", "group"] as const;
type View = (typeof VIEWS)[number];

export default async function CostsPage({ searchParams }: { searchParams: Promise<Search> }) {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const sp = await searchParams;
  const view: View = VIEWS.includes(sp.view as View) ? (sp.view as View) : "list";
  const groupId = sp.group ?? "all";

  const [all, groups] = await Promise.all([
    listAppointmentCosts(ctx.db, ctx.familyId),
    listCareGroups(ctx.db, ctx.familyId),
  ]);

  // กรองกลุ่มก่อนคำนวณทุกอย่าง ตัวเลขบนหน้าจึงตรงกับที่กรองไว้เสมอ
  const items = groupId === "all" ? all : all.filter((i) => i.groupId === groupId);
  const totals = totalsOf(items);
  const canEdit = can.writeRecords(ctx.role);

  const href = (next: Partial<Search>) => {
    const q = new URLSearchParams();
    const v = next.view ?? view;
    const g = next.group ?? groupId;
    if (v !== "list") q.set("view", v);
    if (g !== "all") q.set("group", g);
    if (next.month) q.set("month", next.month);
    const s = q.toString();
    return s ? `/appointments/costs?${s}` : "/appointments/costs";
  };

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <Link
          href="/appointments"
          aria-label="ปิด"
          className="-ml-2 flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <X size={22} strokeWidth={1.9} />
        </Link>
        <div className="flex min-w-0 flex-col">
          <h1 className="flex items-center gap-2 text-[17px] font-semibold text-ink-900">
            <Wallet size={20} strokeWidth={1.8} className="text-peach-700" />
            ค่าใช้จ่ายนัดหมาย
          </h1>
          <span className="text-xs text-ink-400">
            {totals.counted} จาก {items.length} นัดระบุแล้ว
          </span>
        </div>
      </header>

      {all.length === 0 ? (
        <EmptyState canEdit={canEdit} />
      ) : (
        <>
          {groups.length > 1 && (
            <GroupFilter groups={groups} active={groupId} hrefFor={(id) => href({ group: id })} />
          )}
          <LinkTabs
            active={view}
            items={[
              { key: "list", label: "รายนัด", href: href({ view: "list" }) },
              { key: "month", label: "รายเดือน", href: href({ view: "month" }) },
              { key: "group", label: "รายกลุ่ม", href: href({ view: "group" }) },
            ]}
          />

          {view === "list" && (
            <>
              <TotalsHeader totals={totals} />
              <CostEditor items={items} canEdit={canEdit} />
            </>
          )}
          {view === "month" && (
            <MonthView items={items} selected={sp.month} href={href} canEdit={canEdit} />
          )}
          {view === "group" && <GroupView all={all} />}
        </>
      )}
    </div>
  );
}

function EmptyState({ canEdit }: { canEdit: boolean }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12 text-center">
      <span className="flex size-20 items-center justify-center rounded-full bg-cream-100">
        <Wallet size={36} strokeWidth={1.5} className="text-brown-300" />
      </span>
      <div className="flex flex-col gap-1.5">
        <p className="text-[17px] font-semibold text-ink-900">ยังไม่มีนัดหมายให้ระบุค่าใช้จ่าย</p>
        <p className="max-w-xs text-sm leading-relaxed text-ink-600">
          เพิ่มนัดหมายก่อน แล้วค่อยกลับมาบันทึกค่าใช้จ่ายของแต่ละครั้ง
        </p>
      </div>
      {canEdit && (
        <Link
          href="/appointments/new"
          className="inline-flex h-11 items-center rounded-md border border-brown-300 bg-white px-5 text-base font-medium text-brown-700"
        >
          เพิ่มนัดหมาย
        </Link>
      )}
    </div>
  );
}

/** ดูทีละเดือน — ไล่ทุกเดือนต่อกันในหน้าเดียวยิ่งใช้นานยิ่งอ่านไม่ออก */
function MonthView({
  items,
  selected,
  href,
  canEdit,
}: {
  items: CostItem[];
  selected?: string;
  href: (n: Partial<Search>) => string;
  canEdit: boolean;
}) {
  const buckets = byMonth(items);
  if (buckets.length === 0) return null;

  const idx = Math.max(
    0,
    buckets.findIndex((b) => b.key === selected),
  );
  const cur = buckets[selected && buckets.some((b) => b.key === selected) ? idx : buckets.length - 1];
  const at = buckets.indexOf(cur);
  const prev = buckets[at - 1];
  const next = buckets[at + 1];

  const delta = prev && prev.totals.counted > 0 && cur.totals.counted > 0
    ? cur.totals.totalSatang - prev.totals.totalSatang
    : null;

  const max = Math.max(...buckets.map((b) => b.totals.totalSatang), 1);
  const groupsInMonth = byGroup(cur.items).filter((g) => g.totals.counted > 0);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <MonthArrow to={prev && href({ view: "month", month: prev.key })} dir="prev" />
          <span className="text-base font-semibold text-ink-900">{monthKeyLabel(cur.key)}</span>
          <MonthArrow to={next && href({ view: "month", month: next.key })} dir="next" />
        </div>

        <div className="flex flex-col items-center gap-1 text-center">
          {cur.totals.counted === 0 ? (
            <>
              {/* ฿0 อ่านได้ว่าเดือนนี้ไปมาแล้วไม่เสียเงิน ซึ่งคนละเรื่องกับยังไม่กรอก */}
              <span className="text-xl font-semibold text-warning">ยังไม่ได้ระบุ</span>
              <span className="text-xs text-ink-600">
                เดือนนี้มี {cur.items.length} นัด ยังไม่ได้กรอกค่าใช้จ่ายสักนัด
              </span>
            </>
          ) : (
            <>
              <Money satang={cur.totals.totalSatang} className="text-[32px] font-semibold text-ink-900" />
              {delta == null ? (
                <span className="text-xs text-ink-400">เดือนแรกที่มีข้อมูล</span>
              ) : (
                <span className="flex items-center gap-1.5 text-xs text-ink-600">
                  <TrendingUp
                    size={13}
                    strokeWidth={2}
                    className={cn(delta > 0 ? "text-warning" : "rotate-180 text-success")}
                  />
                  {delta > 0 ? "+" : "−"}
                  {baht(Math.abs(delta))} จากเดือนก่อน
                </span>
              )}
            </>
          )}
        </div>

        {groupsInMonth.length > 0 && (
          <div className="flex flex-wrap justify-center gap-3">
            {groupsInMonth.map((g) => (
              <span key={g.id ?? "none"} className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <GroupDot color={g.color} />
                {g.name} {baht(g.totals.totalSatang)}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* แถบเลือกเดือน — กดข้ามได้ และแท่งเล็กทำให้เทียบเดือนได้ในตาเดียว */}
      <div className="flex gap-0.5 overflow-x-auto rounded-md border border-cream-200 bg-white p-1">
        {buckets.map((b) => {
          const on = b.key === cur.key;
          const h = Math.max(3, Math.round((b.totals.totalSatang / max) * 26));
          return (
            <Link
              key={b.key}
              href={href({ view: "month", month: b.key })}
              aria-current={on ? "page" : undefined}
              className={cn(
                "flex w-14 shrink-0 flex-col items-center gap-1.5 rounded-[10px] py-2",
                on && "bg-brown-100",
              )}
            >
              <span className="flex h-7 items-end">
                <span
                  aria-hidden
                  style={{ height: `${h}px` }}
                  className={cn("w-4 rounded-[4px]", on ? "bg-brown-700" : "bg-brown-300")}
                />
              </span>
              <span className={cn("text-[11px]", on ? "font-semibold text-brown-900" : "text-ink-400")}>
                {monthKeyShort(b.key)}
              </span>
            </Link>
          );
        })}
      </div>

      <MissingNote missing={cur.totals.missing} />

      <div className="flex flex-col gap-3">
        <span className="text-sm text-ink-600">รายการในเดือนนี้</span>
        <CostEditor items={cur.items} canEdit={canEdit} />
      </div>
    </div>
  );
}

function MonthArrow({ to, dir }: { to?: string; dir: "prev" | "next" }) {
  const Icon = dir === "prev" ? ChevronLeft : ChevronRight;
  const label = dir === "prev" ? "เดือนก่อนหน้า" : "เดือนถัดไป";
  if (!to) {
    return (
      <span aria-hidden className="flex size-9 items-center justify-center rounded-full bg-cream-50">
        <Icon size={17} strokeWidth={2} className="text-cream-200" />
      </span>
    );
  }
  return (
    <Link
      href={to}
      aria-label={label}
      className="flex size-9 items-center justify-center rounded-full bg-cream-100 text-ink-600 hover:bg-cream-200"
    >
      <Icon size={17} strokeWidth={2} />
    </Link>
  );
}

/** เงินไปลงเรื่องไหนมากที่สุด — คำถามแรกเสมอเมื่อมีหลายกลุ่ม */
function GroupView({ all }: { all: CostItem[] }) {
  const buckets = byGroup(all);
  const grand = totalsOf(all);
  const nowIso = new Date().toISOString();

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex flex-col gap-0.5">
          <span className="text-[13px] text-ink-600">รวมทุกกลุ่ม</span>
          <Money satang={grand.totalSatang} className="text-[32px] font-semibold text-ink-900" />
        </div>
        {grand.totalSatang > 0 && (
          <span aria-hidden className="flex h-2.5 overflow-hidden rounded-full">
            {buckets.map((b) => (
              <span
                key={b.id ?? "none"}
                style={{ width: `${(b.totals.totalSatang / grand.totalSatang) * 100}%` }}
                className={groupColorBar(b.color)}
              />
            ))}
          </span>
        )}
      </div>

      {buckets.map((b) => {
        // ประมาณการนับเฉพาะกลุ่มนี้ ไม่เอาทุกกลุ่มมาเฉลี่ยรวมกัน
        // ไม่งั้นกลายเป็นเอาค่าทำฟันไปคูณจำนวนนัดฝากครรภ์ที่เหลือ
        const est = estimateRemaining(b.items, nowIso);
        const pct = grand.totalSatang > 0 ? (b.totals.totalSatang / grand.totalSatang) * 100 : 0;
        return (
          <div
            key={b.id ?? "none"}
            className="flex flex-col gap-2.5 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-3">
              <span className="flex items-center gap-2">
                <GroupDot color={b.color} className="size-2.5" />
                <span className="text-[15px] font-medium text-ink-900">{b.name}</span>
              </span>
              <span className="flex flex-col items-end gap-0.5">
                <Money satang={b.totals.totalSatang} className="text-[19px] font-semibold text-ink-900" />
                <span className="text-[11px] text-ink-400">
                  {b.totals.missing > 0 ? (
                    <span className="text-warning">{b.totals.missing} นัดยังไม่ระบุ</span>
                  ) : (
                    `${b.items.length} นัด`
                  )}
                </span>
              </span>
            </div>
            <span aria-hidden className="h-1.5 overflow-hidden rounded-full bg-cream-200">
              <span style={{ width: `${pct}%` }} className={cn("block h-full rounded-full", groupColorBar(b.color))} />
            </span>
            <div className="flex gap-3.5">
              <SummaryStat
                label="เฉลี่ยต่อนัด"
                value={b.totals.avgSatang == null ? "—" : baht(b.totals.avgSatang)}
              />
              <span aria-hidden className="w-px self-stretch bg-cream-200" />
              <SummaryStat
                label="ประมาณการที่เหลือ"
                value={est == null ? "—" : baht(est)}
                sub={est == null ? "ยังประมาณไม่ได้" : "จากค่าเฉลี่ย x นัดที่เหลือ"}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

/** แถบสัดส่วนใช้สีเข้มของกลุ่ม เขียนเต็มคำเพราะ Tailwind สแกนหาคลาสตอน build */
function groupColorBar(color: string | null) {
  switch (color) {
    case "peach":
      return "bg-peach-500";
    case "sky":
      return "bg-sky-500";
    case "sage":
      return "bg-sage-500";
    case "plum":
      return "bg-plum-500";
    default:
      return "bg-brown-300";
  }
}
