"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Trash2 } from "lucide-react";
import { deleteKickSession } from "@/actions/kicks";

/**
 * ลบรอบที่นับไปแล้ว
 *
 * ถามยืนยันก่อนเสมอ — ลบแล้วไม่มีทางกู้ และการลบทำให้ค่าเฉลี่ยของตัวเอง
 * เปลี่ยนไปด้วย ซึ่งกระทบทั้งป้าย "ช้ากว่าปกติของคุณ" และหน้าสรุปให้หมอดู
 */
export function DeleteKickSession({ id, label }: { id: string; label: string }) {
  const router = useRouter();
  const { execute, isPending } = useAction(deleteKickSession, {
    onSuccess: () => router.refresh(),
  });

  return (
    <button
      type="button"
      aria-label={`ลบรอบ ${label}`}
      disabled={isPending}
      onClick={() => {
        if (confirm(`ลบรอบ ${label}? ค่าเฉลี่ยของคุณจะคำนวณใหม่จากรอบที่เหลือ`)) {
          execute({ sessionId: id });
        }
      }}
      className="-m-2 flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400 hover:bg-cream-100 disabled:opacity-50"
    >
      <Trash2 size={16} strokeWidth={1.9} />
    </button>
  );
}
