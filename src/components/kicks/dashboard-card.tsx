import Link from "next/link";
import { ChevronRight, Footprints } from "lucide-react";
import { START_WEEK, formatMinutes } from "@/lib/kicks";

/**
 * การ์ดนับลูกดิ้นบนหน้าแรก
 *
 * ไม่แสดงก่อนสัปดาห์ที่เริ่มนับ เพื่อไม่ให้หน้าแรกรกด้วยของที่ยังใช้ไม่ได้
 * — แต่หน้า /kicks ยังเข้าถึงได้ตรงๆ และมีคำอธิบายว่าทำไมยังนับไม่ได้
 *
 * ⚠️ ห้ามใส่ badge สีแดงหรือตัวเลขค้างบนการ์ดนี้เพื่อกระตุ้นให้มานับ
 *    ความกังวลเป็นอาการที่พบบ่อยในคนท้อง การทำให้ตกใจซ้ำๆ ทุกวันมีต้นทุนจริง
 */
export function KickCard({
  week,
  active,
  lastDurationMs,
  avgMs,
}: {
  week: number | null;
  active: boolean;
  lastDurationMs: number | null;
  avgMs: number | null;
}) {
  if (week == null || week < START_WEEK) return null;

  return (
    <Link
      href="/kicks"
      className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="flex items-center gap-2">
          <Footprints size={20} strokeWidth={1.9} className="shrink-0 text-peach-700" />
          <span className="text-[15px] font-medium text-ink-900">นับลูกดิ้น</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-600">
            {active ? "กำลังนับอยู่" : "วันนี้ยังไม่ได้นับ"}
          </span>
          <ChevronRight size={18} strokeWidth={2} className="text-ink-400" />
        </span>
      </span>

      {(lastDurationMs != null || avgMs != null) && (
        <span className="flex gap-2.5">
          <Cell label="ครั้งล่าสุด" value={lastDurationMs != null ? formatMinutes(lastDurationMs) : "—"} />
          <Cell label="เฉลี่ยของคุณ" value={avgMs != null ? formatMinutes(avgMs) : "—"} />
        </span>
      )}
    </Link>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-1 flex-col gap-0.5 rounded-[10px] bg-cream-50 px-3 py-2">
      <span className="text-xs text-ink-600">{label}</span>
      <span className="text-[15px] font-semibold text-ink-900">{value}</span>
    </span>
  );
}
