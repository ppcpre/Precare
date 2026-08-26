import Link from "next/link";
import { Pin } from "lucide-react";

const TYPE_LABEL: Record<string, string> = {
  ultrasound: "อัลตราซาวด์",
  family: "ครอบครัว",
  other: "",
};

export function PhotoTile({
  id,
  r2Key,
  type,
  pinned,
  caption,
}: {
  id: string;
  r2Key: string;
  type: string;
  pinned: boolean;
  caption: string | null;
}) {
  const label = TYPE_LABEL[type];
  return (
    <Link
      href={`/album/${id}`}
      className="relative block aspect-square overflow-hidden rounded-[10px] border border-cream-200 bg-cream-100"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2 ผ่าน route ที่เช็ค session แล้ว next/image ตั้ง unoptimized อยู่แล้ว */}
      <img
        src={`/api/media/${r2Key}`}
        alt={caption ?? "รูปในอัลบั้ม"}
        loading="lazy"
        className="size-full object-cover"
      />
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
