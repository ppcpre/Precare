"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { deletePhoto, togglePin } from "@/actions/photos";

export function PhotoActions({ id, pinned }: { id: string; pinned: boolean }) {
  const router = useRouter();
  const pin = useAction(togglePin, { onSuccess: () => router.refresh() });
  const del = useAction(deletePhoto, {
    onSuccess: () => {
      router.push("/album");
      router.refresh();
    },
  });
  const err = pin.result.serverError ?? del.result.serverError;

  return (
    <div className="flex flex-col gap-2">
      {err && <p className="text-center text-xs text-danger">{err}</p>}
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
