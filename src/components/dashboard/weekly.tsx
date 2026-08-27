"use client";

import { useState } from "react";
import { Baby, Info, Ruler, Weight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DISCLAIMER, sizeImageKey, type WeeklyContent } from "@/data/weekly-content";
import { cn } from "@/lib/cn";

/**
 * การ์ด "ขนาดของลูกน้อย" + "พัฒนาการของหนูน้อย" (Phase 2)
 *
 * เป็น client component ด้วยเหตุผลเดียว: รูปเทียบขนาดยังไม่มีไฟล์จริงใน R2
 * ต้องมี onError ไว้สลับไปไอคอนแทน ไม่งั้นจะเห็นไอคอนรูปพังของเบราว์เซอร์
 * ส่วนที่เหลือเป็น markup ล้วน ไม่มี state อื่น
 */
function SizeImage({ week, size }: { week: number; size: string }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-full bg-peach-100">
      {failed ? (
        <Baby size={36} strokeWidth={1.5} className="text-peach-700" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2, next/image ตั้ง unoptimized อยู่แล้วจึงไม่ได้ประโยชน์
        <img
          src={`/api/asset/${sizeImageKey(week)}`}
          alt={`ขนาดประมาณ${size}`}
          width={80}
          height={80}
          className="size-full object-contain"
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function WeeklySizeCard({ content }: { content: WeeklyContent }) {
  const [showMeasureNote, setShowMeasureNote] = useState(false);
  // ดึงออกมาเป็นตัวแปรเพื่อให้ TypeScript narrow ได้ — เช็คผ่าน boolean แยก
  // ไม่ทำให้ content.weightG แคบลงตาม
  const { lengthCm, weightG } = content;

  return (
    <Card className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-ink-600">ขนาดของลูกน้อย</h2>

      <div className="flex items-center gap-4">
        <SizeImage week={content.week} size={content.size} />
        <div className="flex flex-col gap-1">
          <span className="text-xs text-ink-600">สัปดาห์นี้ตัวประมาณ</span>
          <span className="text-xl font-semibold text-ink-900">{content.size}</span>
        </div>
      </div>

      {lengthCm != null && weightG != null ? (
        <div className="flex gap-2">
          <span className="flex flex-1 items-center gap-2 rounded-sm bg-cream-100 px-3 py-2">
            <Ruler size={16} strokeWidth={1.8} className="shrink-0 text-ink-400" />
            <span className="text-sm text-ink-900">{lengthCm} ซม.</span>
          </span>
          <span className="flex flex-1 items-center gap-2 rounded-sm bg-cream-100 px-3 py-2">
            <Weight size={16} strokeWidth={1.8} className="shrink-0 text-ink-400" />
            <span className="text-sm text-ink-900">
              {weightG >= 1000 ? `${(weightG / 1000).toFixed(2)} กก.` : `${weightG} ก.`}
            </span>
          </span>
        </div>
      ) : (
        // สัปดาห์ 4–7 ยังเล็กเกินกว่าจะวัดเป็นมาตรฐานได้ อย่าโชว์ช่องว่างเปล่าๆ
        <p className="rounded-sm bg-cream-100 px-3 py-2 text-[13px] leading-relaxed text-ink-600">
          ช่วงนี้ตัวยังเล็กเกินกว่าจะวัดความยาวและน้ำหนักเป็นมาตรฐานได้
        </p>
      )}

      {/* ตัวเลขกระโดด 10 ซม. ที่สัปดาห์ 21 เพราะเปลี่ยนวิธีวัด ไม่ใช่ลูกโตพรวด */}
      {content.measure === "crown-heel" && content.week <= 22 && (
        <button
          type="button"
          onClick={() => setShowMeasureNote((v) => !v)}
          className="flex h-auto min-h-0 items-start gap-1.5 rounded-sm p-0 text-left text-xs text-ink-400 hover:text-ink-600"
        >
          <Info size={13} strokeWidth={1.9} className="mt-0.5 shrink-0" />
          <span className={cn(showMeasureNote && "text-ink-600")}>
            {showMeasureNote
              ? "ตั้งแต่สัปดาห์ที่ 21 เปลี่ยนวิธีวัดจาก หัวถึงก้น เป็น หัวถึงส้นเท้า ตัวเลขจึงเพิ่มขึ้นมากในสัปดาห์เดียว ไม่ได้แปลว่าลูกโตผิดปกติ"
              : "ทำไมตัวเลขเพิ่มขึ้นเยอะจากสัปดาห์ก่อน"}
          </span>
        </button>
      )}

      <p className="text-[11px] leading-relaxed text-ink-400">{DISCLAIMER}</p>
    </Card>
  );
}

export function WeeklyDevelopmentCard({ content }: { content: WeeklyContent }) {
  return (
    <Card className="flex flex-col gap-2 border-peach-300 bg-peach-100">
      <h2 className="text-sm font-medium text-ink-600">พัฒนาการของหนูน้อย</h2>
      <p className="text-[15px] leading-relaxed text-ink-900">{content.development}</p>
      <p className="text-[11px] text-ink-400">
        ข้อมูลให้ความรู้ทั่วไป ไม่ใช่คำแนะนำทางการแพทย์
      </p>
    </Card>
  );
}
