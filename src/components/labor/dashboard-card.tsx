import Link from "next/link";
import { ChevronRight, Waves } from "lucide-react";
import { START_WEEK } from "@/lib/labor";

/**
 * การ์ดจับเวลาการบีบตัวบนหน้าแรก
 *
 * ไม่แสดงก่อนสัปดาห์ที่เปิดใช้ เพราะการเห็นทางเข้าตั้งแต่ไตรมาสสอง
 * ชวนให้จับเวลาการบีบตัวเตือนแล้วตกใจโดยไม่จำเป็น
 * — แต่หน้า /labor ยังเข้าถึงได้ตรงๆ และอธิบายว่าทำไมยังจับไม่ได้ พร้อมพาไปหาหมอ
 *
 * ⚠️ ห้ามใส่ badge สีแดงหรือตัวนับเพื่อกระตุ้นให้มาจับเวลา
 *    ด้วยเหตุผลเดียวกับการ์ดนับลูกดิ้น — ความกังวลมีต้นทุนจริง
 */
export function LaborCard({ week, active }: { week: number | null; active: boolean }) {
  if (week == null || week < START_WEEK) return null;

  return (
    <Link
      href="/labor"
      className="flex items-center justify-between gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <span className="flex items-center gap-2.5">
        <Waves size={18} strokeWidth={1.9} className="text-peach-700" />
        <span className="flex flex-col">
          <span className="text-[15px] font-medium text-ink-900">จับเวลาการบีบตัว</span>
          <span className="text-xs text-ink-400">
            {active ? "กำลังจับเวลาอยู่" : "ใช้ตอนเริ่มรู้สึกท้องแข็งเป็นจังหวะ"}
          </span>
        </span>
      </span>
      <ChevronRight size={18} strokeWidth={2} className="shrink-0 text-ink-400" />
    </Link>
  );
}
