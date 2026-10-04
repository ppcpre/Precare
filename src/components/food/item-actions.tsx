"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Trash2 } from "lucide-react";
import { deleteFoodLog } from "@/actions/food";

/** ลบรายการอาหาร — ถามก่อนเพราะกดพลาดแล้วต้องพิมพ์ใหม่ทั้งรายการ */
export function FoodItemActions({ id, name }: { id: string; name: string }) {
  const router = useRouter();
  const del = useAction(deleteFoodLog, { onSuccess: () => router.refresh() });

  return (
    <button
      type="button"
      disabled={del.isPending}
      aria-label={`ลบ ${name}`}
      onClick={() => {
        if (confirm(`ลบ ${name} ออกจากรายการวันนี้?`)) del.execute({ id });
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400 disabled:opacity-40"
    >
      <Trash2 size={16} strokeWidth={1.8} />
    </button>
  );
}
