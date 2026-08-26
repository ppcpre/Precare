"use client";

import { useEffect } from "react";
import { AlertCircle, RotateCw } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

/** การ์ด inline ไม่ใช่ modal เต็มจอ ตาม screen-blueprint §3 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app error]", error);
  }, [error]);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 rounded-md border border-danger bg-cream-100 p-4">
        <AlertCircle size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-danger" />
        <div className="flex flex-col gap-1">
          <p className="font-medium text-ink-900">โหลดข้อมูลไม่สำเร็จ</p>
          <p className="text-sm leading-relaxed text-ink-600">
            เกิดข้อผิดพลาดชั่วคราว ลองใหม่อีกครั้ง ถ้ายังไม่ได้ให้ลองรีเฟรชหน้า
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-ink-400">รหัสอ้างอิง: {error.digest}</p>
          )}
        </div>
      </div>
      <div className="flex gap-2">
        <Button variant="secondary" onClick={reset}>
          <RotateCw size={18} strokeWidth={1.9} />
          ลองใหม่
        </Button>
        <ButtonLink href="/dashboard" variant="ghost">
          กลับหน้าแรก
        </ButtonLink>
      </div>
    </div>
  );
}
