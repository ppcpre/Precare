import Link from "next/link";
import { Plus, Play } from "lucide-react";
import type { Timeline } from "@/lib/child-timeline";
import type { MediaBase } from "@/lib/media-src";
import { mediaUrl } from "@/lib/media-src";
import { cn } from "@/lib/cn";

/**
 * ช่องอายุทั้ง 26 ช่อง
 *
 * ช่องว่างแสดงเสมอ ไม่กรองทิ้ง — การเห็นว่าเดือนไหนยังไม่มีรูปคือเหตุผลเดียว
 * ที่หน้านี้มีอยู่ ถ้าโชว์แค่ช่องที่มีรูป มันก็คืออัลบั้มเรียงตามวันซึ่งมีแล้ว
 *
 * กดช่องว่าง → ไปหน้าอัปโหลดพร้อมวันที่ตั้งต้นเป็นวันแรกของช่องนั้น
 * คนอัปย้อนหลังทีละเดือนจะได้ไม่ต้องไล่เลือกวันเองทุกครั้ง
 */
export function TimelineGrid({
  timeline,
  childId,
  mediaBase,
  canWrite,
}: {
  timeline: Timeline;
  childId: string;
  mediaBase: MediaBase | null;
  canWrite: boolean;
}) {
  return (
    <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
      {timeline.slots.map((s) => {
        const cover = s.cover;
        const src = cover ? mediaUrl(mediaBase, cover.thumbKey ?? cover.r2Key) : null;
        const extra = s.items.length - 1;

        const inner = (
          <>
            <span
              className={cn(
                "relative flex aspect-square items-center justify-center overflow-hidden rounded-lg",
                cover ? "bg-cream-100" : "border border-dashed border-cream-200 bg-white",
              )}
            >
              {src ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Plus size={18} className="text-ink-400" aria-hidden />
              )}
              {cover?.mediaKind === "video" && (
                <Play
                  size={16}
                  className="absolute right-1 top-1 fill-white text-white drop-shadow"
                  aria-hidden
                />
              )}
              {extra > 0 && (
                <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 text-[11px] font-medium text-white tabular-nums">
                  +{extra}
                </span>
              )}
            </span>
            <span
              className={cn(
                "mt-1 block truncate text-center text-[11px]",
                cover ? "text-ink-700" : "text-ink-400",
              )}
            >
              {s.label}
            </span>
          </>
        );

        /** viewer กดช่องว่างไม่ได้ — ไม่มีสิทธิ์อัปโหลดอยู่แล้ว
         *  แต่ยังเห็นว่าช่องไหนว่าง ซึ่งเป็นข้อมูลที่ไม่ได้หวงอะไร */
        if (!cover && !canWrite) {
          return (
            <li key={s.id} className="opacity-60">
              {inner}
            </li>
          );
        }

        return (
          <li key={s.id}>
            <Link
              href={
                cover
                  ? `/baby/${childId}/${s.id}`
                  : `/album/upload?childId=${childId}&takenAt=${s.startsOn ?? ""}`
              }
              aria-label={
                cover
                  ? `${s.label} · ${s.items.length} รูป`
                  : `${s.label} · ยังไม่มีรูป เพิ่มรูป`
              }
              className="block rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown-700"
            >
              {inner}
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
