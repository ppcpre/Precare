"use client";

import { useEffect } from "react";
import { X } from "lucide-react";

/**
 * แผ่นเลื่อนขึ้นจากล่าง — ใช้กับของที่จบในแตะเดียว (ขวดนม ผ้าอ้อม)
 *
 * ไม่ใช้ <dialog> เพราะ showModal ดันแผ่นไปกลางจอบน Safari รุ่นเก่า
 * ปิดได้ทั้งปุ่ม X แตะพื้นหลัง และปุ่ม Escape
 */
export function Sheet({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        aria-label="ปิด"
        onClick={onClose}
        className="absolute inset-0 bg-ink-900/35"
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="relative flex max-h-[90dvh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-lg bg-white px-4 pt-2 pb-[calc(1rem+var(--safe-b,0px))] shadow-[var(--shadow-modal)]"
      >
        <span aria-hidden className="mx-auto h-1 w-10 rounded-full bg-cream-300" />
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-ink-900">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="ปิด"
            className="flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
          >
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
