import Link from "next/link";
import { ChevronRight, Wallet } from "lucide-react";
import { baht } from "@/lib/money";
import { totalsOf, type CostItem } from "@/lib/costs";

/**
 * ทางเข้าหน้าค่าใช้จ่าย — อยู่แถวหัวข้อคู่กับปุ่มเพิ่มนัดหมาย
 *
 * เดิมเป็นการ์ดเต็มความกว้าง ซึ่งบนจอกว้างกลายเป็นแถบยาวที่มีข้อความอยู่ซ้ายสุด
 * ตัวเลขอยู่ขวาสุด แล้วว่างกลางทั้งแถบ ดูไม่เข้ากับหน้าอื่นในแอป
 * ย่อเป็นปุ่มแทน ยังเห็นยอดรวมโดยไม่ต้องกด และไม่กินพื้นที่แนวตั้ง
 *
 * ไม่แสดงเลยเมื่อยังไม่มีนัดหมาย — ยอด ฿0 บนหน้าที่ยังว่างเปล่าไม่ได้บอกอะไร
 */
export function CostEntryButton({ items }: { items: CostItem[] }) {
  if (items.length === 0) return null;

  const { totalSatang, missing } = totalsOf(items);
  const label = missing
    ? `ค่าใช้จ่ายทั้งหมด ${baht(totalSatang)} · ยังไม่ได้ระบุ ${missing} นัด`
    : `ค่าใช้จ่ายทั้งหมด ${baht(totalSatang)}`;

  return (
    <Link
      href="/appointments/costs"
      aria-label={label}
      className="relative inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-cream-200 bg-white pl-3 pr-2 hover:bg-cream-50"
    >
      <Wallet size={17} strokeWidth={1.9} className="shrink-0 text-peach-700" />
      <span className="hidden text-sm text-ink-600 sm:inline">ค่าใช้จ่าย</span>
      <span className="text-[15px] font-semibold tabular-nums text-ink-900">
        {baht(totalSatang)}
      </span>
      <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-ink-400" />

      {/* จุดเตือนแทนข้อความยาว รายละเอียดอยู่ใน aria-label และในหน้าปลายทาง */}
      {missing > 0 && (
        <span
          aria-hidden
          className="absolute -right-0.5 -top-0.5 size-2.5 rounded-full bg-warning ring-2 ring-cream-50"
        />
      )}
    </Link>
  );
}
