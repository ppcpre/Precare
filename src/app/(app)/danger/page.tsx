import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { DANGER_GROUPS, EMS } from "@/data/danger-signs";
import { EmsButton } from "@/components/danger/call-buttons";

export const metadata = { title: "อาการที่ต้องไปโรงพยาบาล · Pre Care" };

/**
 * หน้าเลือกว่าใครมีอาการ
 *
 * ไม่ต้องล็อกอินก็ควรเปิดได้ในอนาคต แต่ตอนนี้อยู่ในโซนแอปตามเดิม — เนื้อหาเป็น
 * static ทั้งหมด ไม่แตะ D1 เลย หน้านี้จึงเปิดได้แม้เน็ตแย่และ cache ได้
 *
 * ⚠️ ไม่มีแบบประเมินอาการโดยตั้งใจ งานวิจัยพบว่า symptom checker คัดกรองแม่น
 *    55.8% และ under-triage เคสฉุกเฉินถึง 78.6% — ความผิดพลาดแบบที่พบบ่อยที่สุด
 *    คือบอกว่าไม่ฉุกเฉินทั้งที่ฉุกเฉิน ซึ่งคือความเสียหายที่หน้านี้ตั้งใจจะป้องกัน
 *    ดู docs/danger-signs-research.md §1
 */
export default function DangerHubPage() {
  return (
    <div className="flex flex-col gap-4 pb-8">
      <h1 className="text-2xl font-semibold text-ink-900">อาการที่ต้องไปโรงพยาบาล</h1>

      <div className="flex flex-col gap-2">
        <EmsButton big />
        <p className="text-sm leading-relaxed text-ink-600">{EMS.appHint}</p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {DANGER_GROUPS.map((g) => (
          <li key={g.id}>
            <Link
              href={`/danger/${g.id}`}
              className="flex items-center gap-3.5 rounded-xl border border-cream-200 bg-white p-4"
            >
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="text-xl font-bold text-ink-900">{g.name}</span>
                <span className="text-[15px] leading-relaxed text-ink-600">{g.hint}</span>
              </span>
              <ChevronRight size={24} strokeWidth={2.4} className="shrink-0 text-brown-700" />
            </Link>
          </li>
        ))}
      </ul>

      {/* ตัวเลขของ NHS บอกว่า 8 ใน 10 คนที่เปิดหน้าแบบนี้แค่ไม่แน่ใจ ไม่ได้กำลังแย่
          ปิดท้ายด้วยการชวนให้โทรถาม ไม่ใช่ตะโกนว่าฉุกเฉินใส่ทุกคน */}
      <p className="text-base leading-relaxed text-ink-900">
        ไม่แน่ใจว่าอาการไหน — โทรถามได้เลย
      </p>
    </div>
  );
}
