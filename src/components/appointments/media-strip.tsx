import Link from "next/link";
import { Images, Play, Plus } from "lucide-react";
import { formatClip } from "@/lib/video";

type Item = {
  id: string;
  r2Key: string;
  thumbKey: string | null;
  mediaKind: string;
  durationMs: number | null;
  caption: string | null;
};

/**
 * ไฟล์ที่แนบกับนัดหมาย
 *
 * ไฟล์แนบไม่ได้อยู่แค่ใต้นัด — มันเข้าอัลบั้มด้วย เพราะใบสั่งยาหรือคลิป
 * อัลตราซาวด์จากวันนั้นเป็นของชิ้นเดียวกันที่คนหาจากสองทาง
 * บางคนจำว่า "วันที่ไปหาหมอ" บางคนจำว่า "นัดครั้งที่ 5" ต้องเจอทั้งสองทาง
 * บอกไว้ตรงนี้ด้วย ไม่งั้นคนจะอัปซ้ำสองรอบเพราะคิดว่าคนละที่กัน
 */
export function AppointmentMedia({
  appointmentId,
  takenAt,
  items,
  canWrite,
}: {
  appointmentId: string;
  takenAt: string;
  items: Item[];
  canWrite: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-600">ไฟล์แนบ</span>
        {items.length > 0 && (
          <span className="text-xs text-ink-400">{items.length} ไฟล์</span>
        )}
      </div>

      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {canWrite && (
          <Link
            href={`/album/upload?appointmentId=${appointmentId}&takenAt=${takenAt}`}
            className="flex size-[88px] shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-brown-300 bg-cream-50 text-ink-600"
          >
            <Plus size={19} strokeWidth={2} className="text-brown-500" />
            <span className="text-[11px]">เพิ่ม</span>
          </Link>
        )}

        {items.map((m) => {
          const isVideo = m.mediaKind === "video";
          const key = isVideo ? m.thumbKey : m.r2Key;
          return (
            <Link
              key={m.id}
              href={`/album/${m.id}`}
              className="relative size-[88px] shrink-0 overflow-hidden rounded-[10px] border border-cream-200 bg-cream-100"
            >
              {key ? (
                /* eslint-disable-next-line @next/next/no-img-element -- ไฟล์จาก R2 ผ่าน route ที่เช็คสิทธิ์แล้ว */
                <img
                  src={`/api/media/${key}`}
                  alt={m.caption ?? (isVideo ? "คลิปที่แนบกับนัด" : "รูปที่แนบกับนัด")}
                  loading="lazy"
                  className="size-full object-cover"
                />
              ) : (
                <span className="block size-full bg-ink-900/85" />
              )}
              {isVideo && (
                <>
                  <span aria-hidden className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-7 items-center justify-center rounded-full bg-white/90">
                      <Play size={13} strokeWidth={2.2} className="text-ink-900" />
                    </span>
                  </span>
                  {m.durationMs != null && (
                    <span className="absolute bottom-1 right-1 rounded-[5px] bg-[rgba(43,36,32,0.72)] px-1.5 py-0.5 text-[10px] tabular-nums text-white">
                      {formatClip(m.durationMs)}
                    </span>
                  )}
                </>
              )}
            </Link>
          );
        })}
      </div>

      <p className="flex items-start gap-2 text-xs leading-relaxed text-ink-400">
        <Images size={14} strokeWidth={1.9} className="mt-px shrink-0" />
        ไฟล์ที่แนบจะขึ้นในอัลบั้มด้วย โดยใช้วันที่ของนัดเป็นวันที่ถ่าย
      </p>
    </div>
  );
}
