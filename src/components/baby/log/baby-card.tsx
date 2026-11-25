import Link from "next/link";
import { ChevronRight } from "lucide-react";
import type { BabyLogKind } from "@/db/schema";
import type { BabyLogView, DaySummary } from "@/lib/baby-log";
import { ageLabel } from "@/lib/child-age";
import { Card } from "@/components/ui/card";
import { QuickGrid } from "./quick-grid";
import { summaryLine } from "./day-summary";

export type BabyCardData = {
  id: string;
  name: string;
  birthDate: string;
  latest: Partial<Record<BabyLogKind, BabyLogView>>;
  summary: DaySummary;
};

/**
 * A1 — การ์ดลูกบนหน้าแรก ขึ้นแทนการ์ดอายุครรภ์ เฉพาะเมื่อมีคนกดเพิ่มลูกแล้ว
 * ⚠️ ไม่มีคำแสดงความยินดี ไม่มี "ลูกน้อย" — ตามหลักเดียวกับ PostpartumCard
 */
export function BabyCard({
  child,
  today,
  canWrite,
}: {
  child: BabyCardData;
  today: string;
  canWrite: boolean;
}) {
  return (
    <Card role="region" aria-label={`บันทึกของ${child.name}`} className="flex flex-col gap-3 rounded-lg p-3.5">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden
            className="flex size-10 shrink-0 items-center justify-center rounded-full border-2 border-peach-300 bg-plum-100 text-[15px] font-semibold text-plum-700"
          >
            {child.name.slice(0, 1)}
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="truncate text-[17px] font-semibold text-ink-900">{child.name}</span>
            <span className="text-[13px] text-ink-600">{ageLabel(child.birthDate, today)}</span>
          </span>
        </span>
        <Link
          href={`/baby/${child.id}/log`}
          className="flex min-h-11 shrink-0 items-center gap-0.5 text-sm font-medium text-brown-700"
        >
          ดูทั้งวัน
          <ChevronRight size={17} />
        </Link>
      </div>
      <QuickGrid childId={child.id} latest={child.latest} canWrite={canWrite} />
      <p className="text-[13px] text-ink-600">
        <span className="text-ink-400">วันนี้</span> {summaryLine(child.summary)}
      </p>
    </Card>
  );
}
