import { CalendarDays } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { GestationProgress } from "@/components/ui/progress";
import { thaiDate } from "@/lib/format";
import type { GestationalAge } from "@/lib/pregnancy";

/** เลขสัปดาห์คือจุดสายตาแรกของหน้า ตาม design principle ข้อ 2 */
export function GestationHero({
  ga,
  daysLeft,
  dueDate,
}: {
  ga: GestationalAge;
  daysLeft: number | null;
  dueDate: string | null;
}) {
  const overdue = daysLeft != null && daysLeft < 0;
  return (
    <Card className="flex flex-col gap-3.5 rounded-lg border-peach-300 bg-peach-100 p-5">
      <span className="text-center text-sm text-ink-600">อายุครรภ์</span>

      <div className="flex items-baseline justify-center gap-2.5">
        <span className="text-[52px] leading-none font-semibold text-peach-700">{ga.weeks}</span>
        <div className="flex flex-col">
          <span className="font-medium text-brown-900">สัปดาห์</span>
          <span className="text-sm text-ink-600">{ga.days} วัน</span>
        </div>
      </div>

      <GestationProgress week={ga.weeks} />

      <div className="flex items-center justify-between pt-1">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-ink-400">ไตรมาส</span>
          <span className="font-medium text-ink-900">ที่ {ga.trimester}</span>
        </div>
        <span aria-hidden className="h-8 w-px bg-brown-300" />
        <div className="flex flex-col items-end gap-0.5">
          <span className="text-xs text-ink-400">{overdue ? "เลยกำหนด" : "เหลืออีก"}</span>
          <span className="flex items-baseline gap-1">
            {/* เลยกำหนดใช้ warning ไม่ใช่ danger — ไม่ทำให้ตกใจเกินเหตุ */}
            <span
              className={`text-xl leading-none font-bold ${overdue ? "text-warning" : "text-brown-900"}`}
            >
              {daysLeft == null ? "—" : Math.abs(daysLeft)}
            </span>
            <span className="text-[13px] text-ink-600">วัน</span>
          </span>
        </div>
      </div>

      {dueDate && (
        <p className="text-center text-xs text-ink-400">คาดคลอด {thaiDate(dueDate)}</p>
      )}
    </Card>
  );
}

/** ยังไม่ได้ตั้ง LMP — owner กดตั้งได้ คนอื่นเห็นแค่ข้อความ */
export function SetupPrompt({ canEdit }: { canEdit: boolean }) {
  return (
    <Card className="flex flex-col gap-4 rounded-lg border-cream-200 bg-cream-100 p-5">
      <div className="flex items-center gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-white">
          <CalendarDays size={22} strokeWidth={1.8} className="text-brown-700" />
        </span>
        <div className="flex flex-col gap-0.5">
          <span className="font-semibold text-ink-900">ตั้งค่าวันตั้งครรภ์</span>
          <span className="text-[13px] text-ink-600">
            {canEdit ? "เพื่อดูอายุครรภ์และวันคาดคลอด" : "รอเจ้าของครอบครัวตั้งค่า"}
          </span>
        </div>
      </div>
      {canEdit && (
        <ButtonLink href="/profile/pregnancy" full>
          ตั้งค่าตอนนี้
        </ButtonLink>
      )}
    </Card>
  );
}
