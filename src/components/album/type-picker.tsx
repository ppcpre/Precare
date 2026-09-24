"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { setPhotoType } from "@/actions/photos";
import { ALBUM_TYPE_OPTIONS } from "@/lib/photo-types";
import type { AlbumPhotoType } from "@/db/schema";
import { cn } from "@/lib/cn";

/**
 * เปลี่ยนประเภทของไฟล์จากหน้าดูรูป
 *
 * เป็นชิปให้กดเลยทีเดียว ไม่ใช่ dropdown แล้วกดบันทึก — มีสี่ตัวเลือก
 * และเป็นการแก้ที่ผู้ใช้มักทำตอนเพิ่งอัปเสร็จแล้วเห็นว่าเลือกผิด
 * ขั้นตอนยิ่งน้อยยิ่งดี
 */
export function PhotoTypePicker({ id, type }: { id: string; type: AlbumPhotoType }) {
  const router = useRouter();
  const act = useAction(setPhotoType, { onSuccess: () => router.refresh() });
  // ระหว่างรอ server ตอบ ให้ชิปที่กดดูถูกเลือกไว้ก่อน ไม่งั้นจะรู้สึกว่ากดไม่ติด
  const current = act.isPending ? (act.input?.type ?? type) : type;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-ink-600">ประเภท</span>
      <div className="flex flex-wrap gap-2">
        {ALBUM_TYPE_OPTIONS.map((o) => {
          const active = o.value === current;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              disabled={act.isPending}
              onClick={() => o.value !== type && act.execute({ id, type: o.value })}
              className={cn(
                "flex h-11 items-center rounded-md border px-3.5 text-sm",
                active
                  ? "border-brown-700 bg-brown-700 font-medium text-white"
                  : "border-cream-200 bg-white text-ink-900",
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {act.result.serverError && (
        <p className="text-xs text-danger">{act.result.serverError}</p>
      )}
    </div>
  );
}
