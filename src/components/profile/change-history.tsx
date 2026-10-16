import { Card } from "@/components/ui/card";
import { thaiDate } from "@/lib/format";
import type { TrackedProfileField } from "@/db/schema";

const LABEL: Record<TrackedProfileField, string> = {
  lmpDate: "วันประจำเดือนครั้งสุดท้าย",
  dueDate: "วันคาดคลอด",
  heightCm: "ส่วนสูง",
  prePregnancyWeight: "น้ำหนักก่อนตั้งครรภ์",
};

const UNIT: Partial<Record<TrackedProfileField, string>> = {
  heightCm: " ซม.",
  prePregnancyWeight: " กก.",
};

export interface ProfileChange {
  id: string;
  field: TrackedProfileField;
  oldValue: string | null;
  newValue: string | null;
  changedAt: string;
  byName: string;
}

/**
 * ประวัติการแก้ข้อมูลตั้งครรภ์
 *
 * มีเพราะค่าพวกนี้เปลี่ยนความหมายของทั้งแอป — แก้น้ำหนักก่อนตั้งครรภ์ทีเดียว
 * ช่วงเกณฑ์ขยับทั้งกราฟ แก้ LMP ทีเดียวอายุครรภ์เปลี่ยนทั้งระบบ
 * ในแอปที่คนทั้งครอบครัวแก้ได้ ต้องตอบได้ว่าใครแก้ตอนไหน
 */
export function ChangeHistory({ changes }: { changes: ProfileChange[] }) {
  if (changes.length === 0) return null;

  const show = (f: TrackedProfileField, v: string | null) => {
    if (v === null) return "ยังไม่ได้กรอก";
    // วันที่เก็บเป็น YYYY-MM-DD ส่วนอีกสองค่าเป็นตัวเลข
    return f === "lmpDate" || f === "dueDate" ? thaiDate(v) : `${v}${UNIT[f] ?? ""}`;
  };

  return (
    <Card className="flex flex-col gap-2">
      <h2 className="text-sm font-medium text-ink-900">ประวัติการแก้ไข</h2>
      <ul className="flex flex-col gap-1.5">
        {changes.map((c) => (
          <li key={c.id} className="flex flex-col gap-0.5 rounded-sm bg-cream-50 px-3 py-2">
            <span className="text-[13px] text-ink-900">
              {LABEL[c.field]}: {show(c.field, c.oldValue)} → <b>{show(c.field, c.newValue)}</b>
            </span>
            <span className="text-[11px] text-ink-400">
              {c.byName} · {thaiDate(c.changedAt.slice(0, 10))}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
