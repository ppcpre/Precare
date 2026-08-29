import Link from "next/link";
import { Pin } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  ultrasound: "อัลตราซาวด์",
  family: "ครอบครัว",
  other: "",
};

/**
 * การ์ดรูปแบบเห็นคำบรรยาย — ใช้ในมุมมอง "รายละเอียด"
 *
 * คำบรรยายอยู่ใต้รูป ไม่ทับบนรูป เพราะข้อความไทยตัวสูง และรูปอัลตราซาวด์
 * พื้นหลังไม่สม่ำเสมอ ทับแล้วอ่านยากจนต้องใส่เงาทึบ ซึ่งบังรูปไปอีก
 *
 * ส่วนข้อความตรึงความสูงไว้ รูปที่ไม่มีคำบรรยายจะได้ไม่ทำให้การ์ดอื่น
 * ในแถวเดียวกันสูงไม่เท่ากัน
 *
 * แสดงแค่เวลา ไม่ซ้ำวันที่ เพราะหัววันบอกไว้แล้ว
 */
export function PhotoCard({
  id,
  r2Key,
  type,
  pinned,
  caption,
  takenAt,
}: {
  id: string;
  r2Key: string;
  type: string;
  pinned: boolean;
  caption: string | null;
  takenAt: string;
}) {
  const label = TYPE_LABEL[type];
  const time = takenAt.length > 10 ? takenAt.slice(11, 16) : null;

  return (
    <Link href={`/album/${id}`} className="flex w-44 shrink-0 flex-col gap-1.5">
      <span className="relative block aspect-[4/3] overflow-hidden rounded-[10px] border border-cream-200 bg-cream-100">
        {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2 ผ่าน route ที่เช็คสิทธิ์แล้ว next/image ตั้ง unoptimized อยู่แล้ว */}
        <img
          src={`/api/media/${r2Key}`}
          alt={caption ?? "รูปในอัลบั้ม"}
          loading="lazy"
          className="size-full object-cover"
        />
        {label && (
          <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(43,36,32,0.62)] px-2 py-0.5 text-[10px] text-white">
            {label}
          </span>
        )}
        {pinned && (
          <span
            aria-label="รูปเด่นของสัปดาห์"
            className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-[rgba(43,36,32,0.62)]"
          >
            <Pin size={12} strokeWidth={2.2} className="text-white" />
          </span>
        )}
      </span>

      <span className="flex min-h-[52px] flex-col gap-0.5 px-0.5">
        {caption ? (
          <span className="line-clamp-2 text-xs leading-relaxed text-ink-900">{caption}</span>
        ) : (
          <span className="text-xs text-ink-400">ไม่มีคำบรรยาย</span>
        )}
        {time && <span className="text-[11px] text-ink-400">{time}</span>}
      </span>
    </Link>
  );
}
