import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { GroupDot, Money } from "@/components/costs/bits";
import { baht } from "@/lib/money";
import { byGroup, totalsOf, type CostItem } from "@/lib/costs";

/**
 * ทางเข้าหน้าค่าใช้จ่ายบนหน้านัดหมาย
 *
 * ทำเป็นแถบสรุปแทนปุ่มเปล่า ตัวเลขจึงเป็นทั้งข้อมูลและปุ่มในตัวเดียว
 * ไม่กดก็ยังเห็นยอด กดก็เข้าไปแก้ได้
 *
 * ไม่แสดงเลยเมื่อยังไม่มีนัดหมาย — ยอด ฿0 บนหน้าที่ยังว่างเปล่าไม่ได้บอกอะไร
 */
export function CostEntryStrip({ items }: { items: CostItem[] }) {
  if (items.length === 0) return null;

  const totals = totalsOf(items);
  const groups = byGroup(items).filter((g) => g.totals.totalSatang > 0);

  return (
    <Link
      href="/appointments/costs"
      className="flex flex-col gap-2.5 rounded-md border border-peach-300 bg-peach-100 p-3.5"
    >
      <span className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <Wallet size={20} strokeWidth={1.8} className="shrink-0 text-peach-700" />
          <span className="text-sm text-ink-600">ค่าใช้จ่ายทั้งหมด</span>
        </span>
        <span className="flex flex-col items-end gap-0.5">
          <span className="flex items-center gap-1.5">
            <Money satang={totals.totalSatang} className="text-[22px] font-semibold text-ink-900" />
            <ChevronRight size={18} strokeWidth={2} className="text-ink-400" />
          </span>
          <span className="text-xs">
            {totals.missing > 0 ? (
              <span className="text-warning">{totals.missing} นัดยังไม่ได้ระบุ</span>
            ) : (
              <span className="text-success">ระบุครบแล้ว</span>
            )}
          </span>
        </span>
      </span>

      {/* บอกตั้งแต่ตรงนี้ว่ายอดมาจากหลายเรื่อง กดเข้าไปแยกดูได้ */}
      {groups.length > 1 && (
        <>
          <span aria-hidden className="h-px bg-peach-300" />
          <span className="flex flex-wrap gap-x-3 gap-y-1">
            {groups.map((g) => (
              <span key={g.id ?? "none"} className="flex items-center gap-1.5 text-[11px] text-ink-600">
                <GroupDot color={g.color} />
                {g.name} {baht(g.totals.totalSatang)}
              </span>
            ))}
          </span>
        </>
      )}
    </Link>
  );
}
