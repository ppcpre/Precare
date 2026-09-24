import Link from "next/link";
import { CalendarDays, ImagePlus } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { GestationProgress } from "@/components/ui/progress";
import { thaiDate } from "@/lib/format";
import { mediaUrl, type MediaBase } from "@/lib/media-src";
import type { GestationalAge } from "@/lib/pregnancy";

/** เลขสัปดาห์คือจุดสายตาแรกของหน้า ตาม design principle ข้อ 2 */
export function GestationHero({
  ga,
  daysLeft,
  dueDate,
  cover,
  canEdit,
  mediaBase,
}: {
  ga: GestationalAge;
  daysLeft: number | null;
  dueDate: string | null;
  /** รูปหน้าปกที่เลือกไว้จากอัลบั้ม — ไม่มีก็กลับไปเป็นการ์ดพื้นสีล้วนแบบเดิม */
  cover?: { key: string; week: number | null } | null;
  canEdit?: boolean;
  /** ตั๋วของ worker เสิร์ฟไฟล์ — ไม่มีก็กลับไปใช้ /api/media ของแอป */
  mediaBase?: MediaBase | null;
}) {
  const overdue = daysLeft != null && daysLeft < 0;
  return (
    <Card className="flex flex-col gap-3.5 rounded-lg border-peach-300 bg-peach-100 p-5">
      {cover ? (
        /* รูปอยู่ในกรอบของการ์ด โค้งมนทั้งสี่มุม ไม่ใช่ชนขอบการ์ด
           เคยลองให้ชนขอบด้วย p-0 แล้วไม่ได้ผล — cn() เป็นแค่ join
           p-4 ของ Card กับ p-0 ที่ส่งมาชนกัน แล้วลำดับใน CSS เป็นคนตัดสิน */
        <div className="relative overflow-hidden rounded-lg">
          {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2 ผ่าน route ที่เช็ค session */}
          <img
            src={mediaUrl(mediaBase, cover.key)}
            alt=""
            className="h-[170px] w-full bg-cream-200 object-cover"
          />
          {/* ไล่เฉดดำทับรูป — อัลตราซาวด์บางใบสว่างจัด ตัวเลขขาวลอยๆ จะอ่านไม่ออก */}
          <span
            aria-hidden
            className="absolute inset-0 bg-gradient-to-b from-black/5 via-black/25 to-black/70"
          />
          {canEdit && (
            <Link
              href="/album"
              aria-label="เปลี่ยนรูปหน้าปก"
              className="absolute top-3 right-3 flex size-9 items-center justify-center rounded-full bg-black/40 text-white"
            >
              <ImagePlus size={17} strokeWidth={1.9} />
            </Link>
          )}
          <div className="absolute inset-x-0 bottom-0 flex flex-col gap-0.5 p-5 text-white">
            <span className="text-[13px] text-white/85">อายุครรภ์</span>
            <div className="flex items-baseline gap-2.5">
              <span className="text-[46px] leading-none font-semibold">{ga.weeks}</span>
              <div className="flex flex-col">
                <span className="font-medium">สัปดาห์</span>
                <span className="text-sm text-white/85">{ga.days} วัน</span>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <>
          <span className="text-center text-sm text-ink-600">อายุครรภ์</span>

          <div className="flex items-baseline justify-center gap-2.5">
            <span className="text-[52px] leading-none font-semibold text-peach-700">{ga.weeks}</span>
            <div className="flex flex-col">
              <span className="font-medium text-brown-900">สัปดาห์</span>
              <span className="text-sm text-ink-600">{ga.days} วัน</span>
            </div>
          </div>
        </>
      )}

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

      {/* ทางเข้าเดียวที่บอกว่าใส่รูปได้ ถ้าไม่มีก็ไม่มีใครรู้ว่าฟีเจอร์นี้มีอยู่ */}
      {!cover && canEdit && (
        <Link
          href="/album"
          /* min-h-11 = 44px ตาม design-system.md ข้อ 4 — ข้อความ text-xs สูงแค่ 16px
             กฎใน globals.css ครอบเฉพาะ a[role="button"] ลิงก์ธรรมดาไม่โดน */
          className="flex min-h-11 items-center justify-center gap-1.5 text-xs font-medium text-brown-700"
        >
          <ImagePlus size={14} strokeWidth={1.9} />
          เลือกรูปหน้าปกจากอัลบั้ม
        </Link>
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
