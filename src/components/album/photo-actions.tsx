"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Image as ImageIcon, ImageOff, Pin, PinOff, Trash2 } from "lucide-react";
import { deletePhoto, setCoverPhoto, togglePin } from "@/actions/photos";

export function PhotoActions({
  id,
  pinned,
  isCover,
  /** คลิปที่ไม่มีเฟรมหน้าปก และใบเสร็จ เอามาเป็นรูปหน้าปกไม่ได้ — ซ่อนปุ่มไปเลย ไม่ใช่ให้กดแล้ว error */
  canBeCover,
}: {
  id: string;
  pinned: boolean;
  isCover: boolean;
  canBeCover: boolean;
}) {
  const router = useRouter();
  const pin = useAction(togglePin, { onSuccess: () => router.refresh() });
  const cover = useAction(setCoverPhoto, { onSuccess: () => router.refresh() });
  const del = useAction(deletePhoto, {
    onSuccess: () => {
      router.push("/album");
      router.refresh();
    },
  });
  const err = pin.result.serverError ?? del.result.serverError ?? cover.result.serverError;

  return (
    <div className="flex flex-col gap-2">
      {err && <p className="text-center text-xs text-danger">{err}</p>}
      {canBeCover && (
        <button
          type="button"
          disabled={cover.isPending}
          onClick={() => cover.execute({ id: isCover ? null : id })}
          className="flex h-11 items-center justify-center gap-2 rounded-md border border-cream-200 bg-white text-sm font-medium text-ink-900"
        >
          {isCover ? (
            <ImageOff size={17} strokeWidth={1.8} />
          ) : (
            <ImageIcon size={17} strokeWidth={1.8} />
          )}
          {isCover ? "เอาออกจากรูปหน้าปก" : "ตั้งเป็นรูปหน้าปกหน้าแรก"}
        </button>
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pin.isPending}
          onClick={() => pin.execute({ id, pinned: !pinned })}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-cream-200 bg-white text-sm font-medium text-ink-900"
        >
          {pinned ? <PinOff size={17} strokeWidth={1.8} /> : <Pin size={17} strokeWidth={1.8} />}
          {pinned ? "เอาหมุดออก" : "ปักหมุด"}
        </button>
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => {
            if (confirm("ลบรูปนี้? การลบย้อนกลับไม่ได้ และจะคืนพื้นที่เก็บไฟล์ให้"))
              del.execute({ id });
          }}
          className="flex h-11 flex-1 items-center justify-center gap-2 rounded-md border border-cream-200 bg-white text-sm font-medium text-danger"
        >
          <Trash2 size={17} strokeWidth={1.8} />
          ลบรูปนี้
        </button>
      </div>
    </div>
  );
}
