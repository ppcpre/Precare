"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Check, Copy, X } from "lucide-react";
import { cancelInvite } from "@/actions/invites";

/**
 * คัดลอกลิงก์ซ้ำ และยกเลิกคำเชิญที่ยังไม่ตอบรับ
 *
 * ปุ่มคัดลอกจำเป็นเพราะระบบยังไม่ส่งอีเมลเอง ลิงก์เคยโผล่ครั้งเดียวตอนเพิ่งสร้าง
 * ปิดหน้านั้นไปแล้วก็ไม่มีทางเอากลับมาอีกเลย คำเชิญที่สร้างเมื่อวานจึงใช้ไม่ได้จริง
 * ทั้งที่ยังไม่หมดอายุ
 *
 * ประกอบลิงก์ฝั่ง client จาก window.location.origin เพราะหน้านี้เป็น server
 * component ที่ไม่รู้ว่าผู้ใช้เปิดจากโดเมนไหน (dev กับ production คนละโดเมน)
 */
export function InviteActions({ id, email }: { id: string; email: string }) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cancel = useAction(cancelInvite, {
    onSuccess: () => router.refresh(),
    onError: ({ error: e }) => setError(e.serverError ?? "ยกเลิกคำเชิญไม่สำเร็จ"),
  });

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/invite/${id}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // เบราว์เซอร์ปฏิเสธ clipboard (ไม่ใช่ https หรือไม่ได้มาจากการกดของผู้ใช้)
      setError("คัดลอกไม่สำเร็จ กดค้างที่ลิงก์เพื่อคัดลอกแทนได้");
    }
  };

  return (
    <div className="flex shrink-0 flex-col items-end gap-1.5">
      <div className="flex gap-1.5">
        <button
          type="button"
          onClick={copy}
          aria-label={`คัดลอกลิงก์คำเชิญของ ${email}`}
          className="flex size-11 items-center justify-center rounded-md border border-cream-200 bg-white text-ink-600"
        >
          {copied ? (
            <Check size={16} strokeWidth={2.2} className="text-success" />
          ) : (
            <Copy size={16} strokeWidth={1.9} />
          )}
        </button>
        <button
          type="button"
          disabled={cancel.isPending}
          aria-label={`ยกเลิกคำเชิญของ ${email}`}
          onClick={() => {
            // ยกเลิกแล้วลิงก์เดิมใช้ไม่ได้อีก ซึ่งย้อนกลับไม่ได้ ต้องถามก่อน
            if (confirm(`ยกเลิกคำเชิญของ ${email}?\nลิงก์ที่ส่งไปแล้วจะใช้ไม่ได้อีก`)) {
              cancel.execute({ id });
            }
          }}
          className="flex size-11 items-center justify-center rounded-md border border-cream-200 bg-white text-danger disabled:opacity-50"
        >
          <X size={17} strokeWidth={2} />
        </button>
      </div>
      {copied && <span className="text-[11px] text-success">คัดลอกแล้ว</span>}
      {error && <span className="text-[11px] text-danger">{error}</span>}
    </div>
  );
}
