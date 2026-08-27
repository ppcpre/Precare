import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { baht } from "@/lib/money";
import { groupColor } from "@/lib/care-group-color";
import { cn } from "@/lib/cn";
import type { Totals } from "@/lib/costs";

export function GroupDot({ color, className }: { color: string | null; className?: string }) {
  return <span aria-hidden className={cn("size-2 shrink-0 rounded-full", groupColor(color).dot, className)} />;
}

export function GroupTag({ name, color }: { name: string; color: string | null }) {
  return (
    <span className={cn("shrink-0 rounded-[6px] px-1.5 py-0.5 text-[11px]", groupColor(color).chip)}>
      {name}
    </span>
  );
}

/** ตัวเลขเงินใช้ tabular-nums เสมอ ไม่งั้นหลักไม่ตรงกันเวลาวางเรียงเป็นคอลัมน์ */
export function Money({ satang, className }: { satang: number; className?: string }) {
  return <span className={cn("tabular-nums", className)}>{baht(satang)}</span>;
}

/**
 * ยอดรวมต้องมาคู่กับจำนวนนัดที่ยังไม่ระบุเสมอ
 * ยอดที่เงียบๆ ไม่นับนัดที่ยังไม่กรอกคือตัวเลขหลอก เอาไปวางแผนเงินไม่ได้
 */
export function MissingNote({ missing }: { missing: number }) {
  if (missing === 0) return null;
  return (
    <p className="flex items-center gap-2 rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
      <AlertCircle size={16} strokeWidth={1.9} className="shrink-0 text-warning" />
      <span>
        ยังไม่ได้ระบุอีก <b className="text-ink-900">{missing} นัด</b> ยอดรวมจึงยังไม่ครบ
      </span>
    </p>
  );
}

export function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="text-xs text-ink-600">{label}</span>
      <span className="text-[17px] font-semibold text-ink-900">{value}</span>
      {sub && <span className="text-[11px] text-ink-400">{sub}</span>}
    </div>
  );
}

export function TotalsHeader({ totals }: { totals: Totals }) {
  return (
    <div className="flex flex-col gap-3.5 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
      <div className="flex flex-col gap-0.5">
        <span className="text-[13px] text-ink-600">รวมทั้งหมด</span>
        <Money satang={totals.totalSatang} className="text-[32px] font-semibold text-ink-900" />
      </div>
      <div className="flex gap-3.5">
        <SummaryStat
          label="เฉลี่ยต่อนัด"
          value={totals.avgSatang == null ? "—" : baht(totals.avgSatang)}
          sub={totals.counted ? `จาก ${totals.counted} นัดที่ระบุแล้ว` : "ยังไม่มีนัดที่ระบุ"}
        />
        <span aria-hidden className="w-px self-stretch bg-cream-200" />
        <SummaryStat
          label="เบิกได้"
          value={baht(totals.claimableSatang)}
          sub={`เบิกแล้ว ${baht(totals.claimedSatang)}`}
        />
      </div>
      <MissingNote missing={totals.missing} />
    </div>
  );
}

/**
 * สลับมุมมองและกรองกลุ่มด้วยลิงก์ ไม่ใช่ state ฝั่ง client
 * ทำให้ทั้งหน้ายังเป็น server component แชร์ URL แล้วเห็นมุมมองเดียวกัน
 * และกดย้อนกลับได้ตามที่คาด
 */
export function LinkTabs({
  items,
  active,
}: {
  items: { href: string; label: string; key: string }[];
  active: string;
}) {
  return (
    <div className="flex gap-1 rounded-[10px] bg-cream-100 p-1">
      {items.map((it) => {
        const on = it.key === active;
        return (
          <Link
            key={it.key}
            href={it.href}
            aria-current={on ? "page" : undefined}
            className={cn(
              "flex flex-1 items-center justify-center rounded-sm px-2 py-2 text-[13px] whitespace-nowrap",
              on
                ? "bg-white font-medium text-brown-900 shadow-[var(--shadow-card)]"
                : "text-ink-600 hover:text-ink-900",
            )}
          >
            {it.label}
          </Link>
        );
      })}
    </div>
  );
}

export function GroupFilter({
  groups,
  active,
  hrefFor,
}: {
  groups: { id: string; name: string; color: string }[];
  active: string;
  hrefFor: (id: string) => string;
}) {
  const all = [{ id: "all", name: "ทั้งหมด", color: null as string | null }, ...groups];
  return (
    <div className="flex flex-wrap gap-1.5">
      {all.map((g) => {
        const on = g.id === active;
        return (
          <Link
            key={g.id}
            href={hrefFor(g.id)}
            aria-current={on ? "page" : undefined}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px]",
              on ? "border-brown-100 bg-brown-100 text-brown-900" : "border-cream-200 bg-white text-ink-600",
            )}
          >
            {g.color && <GroupDot color={g.color} />}
            {g.name}
          </Link>
        );
      })}
    </div>
  );
}
