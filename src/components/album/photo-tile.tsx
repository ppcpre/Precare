import Link from "next/link";
import { Pin, Play } from "lucide-react";
import { formatClip } from "@/lib/video";

const TYPE_LABEL: Record<string, string> = {
  ultrasound: "อัลตราซาวด์",
  family: "ครอบครัว",
  other: "",
};

export function PhotoTile({
  id,
  r2Key,
  thumbKey,
  mediaKind,
  durationMs,
  type,
  pinned,
  caption,
}: {
  id: string;
  r2Key: string;
  thumbKey: string | null;
  mediaKind: string;
  durationMs: number | null;
  type: string;
  pinned: boolean;
  caption: string | null;
}) {
  const label = TYPE_LABEL[type];
  const isVideo = mediaKind === "video";
  // วิดีโอโชว์หน้าปกที่ดึงเฟรมมาตอนอัปโหลด — r2Key ของมันคือตัวคลิป ใส่ใน img ไม่ได้
  const imageKey = isVideo ? thumbKey : r2Key;

  return (
    <Link
      href={`/album/${id}`}
      className="relative block aspect-square overflow-hidden rounded-[10px] border border-cream-200 bg-cream-100"
    >
      {imageKey ? (
        /* eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2 ผ่าน route ที่เช็ค session แล้ว next/image ตั้ง unoptimized อยู่แล้ว */
        <img
          src={`/api/media/${imageKey}`}
          alt={caption ?? (isVideo ? "วิดีโอในอัลบั้ม" : "รูปในอัลบั้ม")}
          loading="lazy"
          className="size-full object-cover"
        />
      ) : (
        // หน้าปกหายได้ถ้าอัปโหลดค้างกลางทาง — พื้นเข้มยังบอกได้ว่าเป็นคลิป
        <span className="block size-full bg-ink-900/85" />
      )}

      {isVideo && (
        <>
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center"
          >
            <span className="flex size-8 items-center justify-center rounded-full bg-white/90">
              <Play size={15} strokeWidth={2.2} className="text-ink-900" />
            </span>
          </span>
          {durationMs != null && (
            <span className="absolute bottom-1.5 right-1.5 rounded-[5px] bg-[rgba(43,36,32,0.72)] px-1.5 py-0.5 text-[10px] tabular-nums text-white">
              {formatClip(durationMs)}
            </span>
          )}
        </>
      )}

      {pinned && (
        <span
          aria-label="รูปเด่นของสัปดาห์"
          className="absolute right-1.5 top-1.5 flex size-6 items-center justify-center rounded-full bg-[rgba(43,36,32,0.62)]"
        >
          <Pin size={12} strokeWidth={2.2} className="text-white" />
        </span>
      )}
      {label && (
        <span className="absolute bottom-1.5 left-1.5 rounded-full bg-[rgba(43,36,32,0.62)] px-2 py-0.5 text-[10px] text-white">
          {label}
        </span>
      )}
    </Link>
  );
}
