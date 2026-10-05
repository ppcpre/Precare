"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { shiftDay } from "@/lib/local-time";
import { thaiDate } from "@/lib/format";

/**
 * เลือกวันของบันทึกอาหาร — ย้อนหลังได้ ล่วงหน้าไม่ได้
 *
 * มีเพราะคนลืมบันทึกเป็นเรื่องปกติ ถ้าบันทึกได้แค่วันนี้ มื้อที่ลืมก็หายไปเลย
 * แล้วกราฟย้อนหลังจะโชว์วันที่ดูเหมือนกินน้อย ทั้งที่จริงคือลืมจด
 *
 * วันอยู่ใน URL (?d=) ไม่ใช่ state ในหน่วยความจำ — กดย้อนกลับจากหน้าอื่นแล้ว
 * ต้องยังอยู่วันเดิม และส่งลิงก์ของวันนั้นให้กันได้
 */
export function DayNav({
  day,
  today,
  userId,
  isMine,
}: {
  day: string;
  today: string;
  userId: string;
  isMine: boolean;
}) {
  const router = useRouter();

  const go = (next: string) => {
    const q = new URLSearchParams();
    if (next !== today) q.set("d", next);
    if (!isMine) q.set("u", userId);
    const s = q.toString();
    router.push(s ? `/food?${s}` : "/food", { scroll: false });
  };

  const prev = shiftDay(day, -1);
  const next = shiftDay(day, 1);
  const atToday = day >= today;

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        aria-label={`ดูวันก่อนหน้า ${thaiDate(prev)}`}
        onClick={() => go(prev)}
        className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
      >
        <ChevronLeft size={19} strokeWidth={1.9} />
      </button>

      {/* input[type=date] ของเบราว์เซอร์เอง — บนมือถือได้ตัวเลือกวันของระบบ
          ซึ่งใช้ง่ายกว่าปฏิทินที่เขียนเองและไม่ต้องโหลด JS เพิ่ม */}
      <label className="flex min-h-11 items-center">
        <span className="sr-only">วันที่ของบันทึก</span>
        <input
          type="date"
          value={day}
          max={today}
          onChange={(e) => e.target.value && go(e.target.value)}
          className="h-11 rounded-md border border-cream-200 bg-white px-2 text-[13px] text-ink-900"
        />
      </label>

      <button
        type="button"
        // วันหน้ายังไม่เกิดขึ้น ซ่อนปุ่มไปเลยตาม design principle ข้อ 5
        // (disabled ที่กดได้แต่ไม่เกิดอะไรทำให้คนสงสัยว่าพังหรือเปล่า)
        aria-label={`ดูวันถัดไป ${thaiDate(next)}`}
        onClick={() => go(next)}
        className={
          atToday
            ? "hidden"
            : "flex size-11 shrink-0 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        }
      >
        <ChevronRight size={19} strokeWidth={1.9} />
      </button>

      {!atToday && (
        <button
          type="button"
          onClick={() => go(today)}
          className="flex min-h-11 shrink-0 items-center rounded-md px-2 text-[13px] font-medium text-brown-700 hover:bg-cream-100"
        >
          วันนี้
        </button>
      )}
    </div>
  );
}
