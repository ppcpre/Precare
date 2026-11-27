"use client";

import { useCallback, useSyncExternalStore } from "react";
import { Bell, X } from "lucide-react";

const DISMISS_KEY = "precare.notifyBannerDismissed";

/**
 * ขอสิทธิ์แจ้งเตือนของเบราว์เซอร์
 *
 * ใช้ useSyncExternalStore แทน useEffect + setState เพราะสถานะที่อ่าน
 * (Notification.permission + localStorage) เป็นของนอก React
 * การ setState ใน effect body ทำให้ render ซ้อนโดยไม่จำเป็น (react-hooks/set-state-in-effect)
 *
 * ⚠️ ข้อจำกัดที่ต้องบอกผู้ใช้ให้ตรง: Notification API ทำงานเฉพาะตอนเปิดแอปค้างไว้
 *    ปิดแท็บแล้วจะไม่เตือน — แก้จริงต้องใช้ Web Push + Service Worker (Phase 2)
 */
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function shouldShow() {
  if (typeof Notification === "undefined") return false;
  if (Notification.permission !== "default") return false;
  return localStorage.getItem(DISMISS_KEY) === null;
}

export function NotifyBanner() {
  // server render คืน false เสมอ — banner โผล่หลัง hydrate เท่านั้น
  const show = useSyncExternalStore(subscribe, shouldShow, () => false);

  const dismiss = useCallback(() => {
    localStorage.setItem(DISMISS_KEY, "1");
    notify();
  }, []);

  if (!show) return null;

  return (
    <div className="flex items-center gap-2.5 rounded-md border border-cream-200 bg-cream-100 px-3.5 py-3">
      <Bell size={20} strokeWidth={1.9} className="shrink-0 text-warning" />
      <p className="flex-1 text-[13px] leading-relaxed text-ink-600">
        เปิดการแจ้งเตือนเพื่อไม่พลาดนัดหมาย
        <span className="block text-xs text-ink-400">
          ทำงานเฉพาะตอนเปิดแอปค้างไว้ ปิดแท็บแล้วจะไม่เตือน
        </span>
      </p>
      <button
        type="button"
        onClick={async () => {
          await Notification.requestPermission();
          dismiss();
        }}
        className="h-auto min-h-0 shrink-0 text-[13px] font-medium text-brown-700"
      >
        เปิด
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="ปิดคำแนะนำ"
        className="h-auto min-h-0 shrink-0 text-ink-400 hover:text-ink-600"
      >
        <X size={16} strokeWidth={2} />
      </button>
    </div>
  );
}
