import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { BabyLogKind } from "@/db/schema";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { listBabyLogs } from "@/lib/baby-queries";
import { isValidDay, localNowIso, shiftDay } from "@/lib/local-time";
import { KIND_LABEL, addSeconds, secondsBetween, spanLabel, stripMarks } from "@/lib/baby-log";
import {
  avgLabel,
  dayUntil,
  rangeLabel,
  weekDays,
  weekStats,
  weekdayLabel,
  type WeekStats,
} from "@/lib/baby-week";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui/card";
import { DayStrip, HourRuler, StripLegend } from "@/components/baby/log/day-strip";
import { KindBadge } from "@/components/baby/log/kind-icon";

export const metadata = { title: "ไทม์ไลน์ของลูก · Pre Care" };

const FILTERS: BabyLogKind[] = ["breast", "bottle", "diaper", "sleep", "pump"];

/**
 * C1 — ไทม์ไลน์ 7 วัน
 *
 * แถวละวัน ใหม่สุดอยู่บน · แยกเลน กิน / ผ้าอ้อม / นอน เหมือนหน้าวันนี้
 * ?end= วันสุดท้ายของช่วง · ?k= ดูประเภทเดียว (ตัวเลขเฉลี่ยไม่เปลี่ยนตาม)
 */
export default async function BabyWeekPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ end?: string; k?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }
  const child = await getChild(ctx.db, ctx.familyId, id);
  if (!child) notFound();

  const nowIso = localNowIso();
  const today = nowIso.slice(0, 10);
  const end = isValidDay(sp.end) && sp.end < today ? sp.end : today;
  const isCurrent = end === today;
  const kind = FILTERS.find((k) => k === sp.k) ?? null;

  const days = weekDays(end);
  const prevDays = weekDays(shiftDay(end, -7));
  // สองสัปดาห์ในคำขอเดียว — สัปดาห์ก่อนใช้แค่เทียบตัวเลข
  const rows = await listBabyLogs(
    ctx.db,
    ctx.familyId,
    child.id,
    `${prevDays[6]}T00:00:00`,
    addSeconds(`${end}T00:00:00`, 86_400),
  );
  const stats = weekStats(rows, days, nowIso);
  const prev = weekStats(rows, prevDays, nowIso);

  const base = `/baby/${child.id}/log/week`;
  const href = (o: { end?: string; k?: BabyLogKind | null }) => {
    const q = new URLSearchParams();
    const e = o.end ?? end;
    if (e !== today) q.set("end", e);
    const k = o.k === undefined ? kind : o.k;
    if (k) q.set("k", k);
    const s = q.toString();
    return s ? `${base}?${s}` : base;
  };

  return (
    <div className="flex flex-col gap-3 pb-24">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/baby/${child.id}/log`}
          aria-label="กลับหน้าบันทึก"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} />
        </Link>
        <h1 className="truncate text-lg font-semibold text-ink-900">ไทม์ไลน์ · {child.name}</h1>
        <span className="size-11" />
      </header>

      <nav aria-label="ดูเฉพาะ" className="-mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1">
        <FilterChip href={href({ k: null })} on={kind === null}>
          ทั้งหมด
        </FilterChip>
        {FILTERS.map((k) => (
          <FilterChip key={k} href={href({ k })} on={kind === k}>
            <KindBadge kind={k} size={22} />
            {KIND_LABEL[k]}
          </FilterChip>
        ))}
      </nav>

      <nav className="flex items-center justify-between" aria-label="เลือกสัปดาห์">
        <Link
          href={href({ end: shiftDay(end, -7) })}
          scroll={false}
          aria-label="สัปดาห์ก่อน"
          className="flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={19} />
        </Link>
        <span className="text-[15px] font-medium text-ink-900">{rangeLabel(days[6], end)}</span>
        {isCurrent ? (
          <span className="size-11" />
        ) : (
          <Link
            href={href({ end: shiftDay(end, 7) > today ? today : shiftDay(end, 7) })}
            scroll={false}
            aria-label="สัปดาห์ถัดไป"
            className="flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
          >
            <ChevronRight size={19} />
          </Link>
        )}
      </nav>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-1.5">
          <span className="w-[30px] shrink-0" />
          <div className="min-w-0 flex-1">
            <HourRuler />
          </div>
        </div>
        {days.map((day) => {
          const until = dayUntil(day, nowIso);
          const marks = stripMarks(rows, day, until).filter((m) => !kind || m.kind === kind);
          const [wd, dd] = weekdayLabel(day).split(" ");
          return (
            <div key={day} className="flex items-center gap-1.5">
              <span className="w-[30px] shrink-0 text-center text-[11px] leading-tight text-ink-600">
                {wd}
                <br />
                {dd}
              </span>
              <DayStrip
                className="flex-1"
                marks={day > today ? [] : marks}
                nowMin={day === today ? secondsBetween(`${day}T00:00:00`, nowIso) / 60 : null}
                hours={false}
                legend={false}
                compact
                label={weekdayLabel(day)}
              />
            </div>
          );
        })}
        <StripLegend />
      </div>

      <StatsCard stats={stats} prev={prev} />
      <p className="text-xs leading-relaxed text-ink-400">
        ตัวเลขเทียบกับลูกคุณเองในสัปดาห์ก่อนเท่านั้น ไม่ได้เทียบกับเกณฑ์
      </p>
    </div>
  );
}

function FilterChip({ href, on, children }: { href: string; on: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      scroll={false}
      aria-current={on ? "page" : undefined}
      className={cn(
        "flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[13px] whitespace-nowrap",
        on ? "border-brown-100 bg-brown-100 text-brown-900" : "border-cream-200 bg-white text-ink-600",
      )}
    >
      {children}
    </Link>
  );
}

function StatsCard({ stats, prev }: { stats: WeekStats; prev: WeekStats }) {
  if (stats.days === 0) {
    return (
      <Card className="p-3.5">
        <p className="text-[13px] text-ink-600">สัปดาห์นี้ยังไม่มีบันทึก</p>
      </Card>
    );
  }
  const hours = (sec: number) => `${avgLabel(sec / 3600)} ชม.`;
  const items: { kind: BabyLogKind; label: string; value: string; before: string | null }[] = [
    {
      kind: "breast",
      label: "กิน",
      value: `${avgLabel(stats.feeds)} ครั้ง`,
      before: prev.days ? `${avgLabel(prev.feeds)} ครั้ง` : null,
    },
    {
      kind: "sleep",
      label: "นอน",
      value: hours(stats.sleepSec),
      before: prev.days ? hours(prev.sleepSec) : null,
    },
    {
      kind: "diaper",
      label: "ฉี่",
      value: `${avgLabel(stats.wet)} ผืน`,
      before: prev.days ? `${avgLabel(prev.wet)} ผืน` : null,
    },
    {
      kind: "sleep",
      label: "นอนยาวสุด",
      value: stats.longestSleepSec ? spanLabel(stats.longestSleepSec) : "–",
      before: prev.longestSleepSec ? spanLabel(prev.longestSleepSec) : null,
    },
  ];
  return (
    <Card className="flex flex-col gap-2.5 p-3.5">
      <h2 className="text-sm text-ink-600">
        7 วันนี้ เฉลี่ยต่อวัน
        {stats.days < 7 && <span className="text-ink-400"> · จาก {stats.days} วันที่มีบันทึก</span>}
      </h2>
      <dl className="grid grid-cols-2 gap-2">
        {items.map((it) => (
          <div key={it.label} className="flex flex-col gap-0.5 rounded-[10px] border border-cream-200 bg-white px-3 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs text-ink-600">
              <KindBadge kind={it.kind} size={18} />
              {it.label}
            </dt>
            <dd className="text-lg font-semibold text-ink-900">{it.value}</dd>
            {it.before && <dd className="text-[11px] text-ink-400">สัปดาห์ก่อน {it.before}</dd>}
          </div>
        ))}
      </dl>
    </Card>
  );
}
