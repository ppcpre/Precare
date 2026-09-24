"use client";

import { useState } from "react";
import { Baby, Info, Ruler, Weight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { DISCLAIMER, sizeImageKey, type WeeklyContent } from "@/data/weekly-content";
import { cn } from "@/lib/cn";

/**
 * การ์ด "พัฒนาการของลูกน้อย" — ขนาดกับพัฒนาการรวมอยู่ใบเดียว (Phase 2)
 *
 * เดิมแยกสองใบ กินความสูงหน้าแรกรวมกันเกือบ 380px ทั้งที่เป็นเรื่องเดียวกัน
 * (ลูกสัปดาห์นี้เป็นยังไง) ตอนนี้ใบเดียว ~245px และอ่านเรียงกันได้ต่อเนื่อง:
 * ตัวประมาณเท่านี้ → ยาว/หนักเท่านี้ → สัปดาห์นี้พัฒนาอะไร
 *
 * เป็น client component ด้วยเหตุผลเดียว: รูปเทียบขนาดยังไม่มีไฟล์จริงใน R2
 * ต้องมี onError ไว้สลับไปไอคอนแทน ไม่งั้นจะเห็นไอคอนรูปพังของเบราว์เซอร์
 */
function SizeImage({ week }: { week: number }) {
  const [failed, setFailed] = useState(false);

  return (
    <span className="flex size-16 shrink-0 items-center justify-center overflow-hidden rounded-full bg-peach-100">
      {failed ? (
        <Baby size={30} strokeWidth={1.5} className="text-peach-700" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2, next/image ตั้ง unoptimized อยู่แล้วจึงไม่ได้ประโยชน์
        <img
          src={`/api/asset/${sizeImageKey(week)}`}
          alt=""
          width={64}
          height={64}
          className="size-full object-contain"
          /**
           * เช็คซ้ำตอน mount — <img> ถูก render มาจาก server ถ้ามันโหลดพัง
           * ตั้งแต่ก่อน React hydrate เสร็จ event error จะผ่านไปแล้ว
           * onError ที่ผูกทีหลังจะไม่มีวันถูกเรียก และรูปพังจะค้างอยู่ตลอด
           */
          ref={(el) => {
            if (el?.complete && el.naturalWidth === 0) setFailed(true);
          }}
          onError={() => setFailed(true)}
        />
      )}
    </span>
  );
}

export function WeeklyBabyCard({ content }: { content: WeeklyContent }) {
  const [showMeasureNote, setShowMeasureNote] = useState(false);
  // ดึงออกมาเป็นตัวแปรเพื่อให้ TypeScript narrow ได้ — เช็คผ่าน boolean แยก
  // ไม่ทำให้ content.weightG แคบลงตาม
  const { lengthCm, weightG } = content;

  return (
    /* ไม่ใส่ bg-peach-100 ทับ — cn() เป็นแค่ join ไม่ได้ merge
       bg-white ของ Card ชนะอยู่ดี ใส่ไว้ก็เป็นคลาสที่ไม่มีผลอะไร หลอกคนอ่าน */
    <Card className="flex flex-col gap-3 border-peach-300">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-ink-600">พัฒนาการของลูกน้อย</h2>
        <span className="shrink-0 text-xs text-ink-400">สัปดาห์ที่ {content.week}</span>
      </div>

      <div className="flex items-center gap-3.5">
        <SizeImage week={content.week} />
        <div className="flex min-w-0 flex-col gap-0.5">
          <span className="text-xs text-ink-600">สัปดาห์นี้ตัวประมาณ</span>
          <span className="text-lg leading-tight font-semibold text-ink-900">{content.size}</span>

          {lengthCm != null && weightG != null ? (
            /* กล่องพื้นครีมแบบเดิม แต่ย้ายมาอยู่ในคอลัมน์ข้างรูป ไม่ใช่แถวเต็ม
               ความกว้างใต้รูปเหมือนก่อน — ได้กรอบเหมือนเดิมโดยไม่เพิ่มแถวใหม่ */
            <span className="mt-0.5 flex gap-2">
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
            </span>
          ) : (
            // สัปดาห์ 4–7 ยังเล็กเกินกว่าจะวัดเป็นมาตรฐานได้ อย่าโชว์ช่องว่างเปล่าๆ
            <span className="mt-0.5 rounded-sm bg-cream-100 px-3 py-2 text-[13px] leading-relaxed text-ink-600">
              ช่วงนี้ตัวยังเล็กเกินกว่าจะวัดความยาวและน้ำหนักเป็นมาตรฐานได้
            </span>
          )}
        </div>
      </div>

      <p className="text-[15px] leading-relaxed text-ink-900">{content.development}</p>

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

      {/* บรรทัดเดียวจริงๆ บนมือถือ — เดิมสองใบมีใบละข้อความ ซ้ำความหมายกันครึ่งหนึ่ง */}
      <p data-testid="weekly-disclaimer" className="text-[11px] text-ink-400">
        {DISCLAIMER}
      </p>
    </Card>
  );
}
