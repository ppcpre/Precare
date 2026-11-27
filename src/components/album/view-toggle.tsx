"use client";

import { useCallback, useSyncExternalStore } from "react";

export type AlbumView = "grid" | "detail";

const KEY = "precare.albumView";

/**
 * มุมมองอัลบั้ม — จำไว้ข้ามการเปิดแอปด้วย localStorage
 *
 * ใช้ useSyncExternalStore เพราะ localStorage เป็นของนอก React
 * และ server ไม่รู้ค่า ถ้าอ่านตอน render แรกจะได้ hydration mismatch
 * getServerSnapshot คืน "grid" เสมอ หน้าจึงเรนเดอร์ default ก่อน
 * แล้วสลับหลัง hydrate ถ้าผู้ใช้เคยเลือกไว้เป็นอย่างอื่น
 *
 * (แบบเดียวกับ NotifyBanner ซึ่งเจอปัญหานี้มาก่อน)
 */
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function read(): AlbumView {
  try {
    return localStorage.getItem(KEY) === "detail" ? "detail" : "grid";
  } catch {
    // โหมดส่วนตัวบางเบราว์เซอร์โยน error ตอนแตะ localStorage
    return "grid";
  }
}

export function useAlbumView() {
  const view = useSyncExternalStore(subscribe, read, () => "grid" as AlbumView);
  const setView = useCallback((v: AlbumView) => {
    try {
      localStorage.setItem(KEY, v);
    } catch {
      // จำไม่ได้ก็ไม่เป็นไร ยังสลับมุมมองในรอบนี้ได้
    }
    emit();
  }, []);
  return [view, setView] as const;
}

export function AlbumViewToggle() {
  const [view, setView] = useAlbumView();
  return (
    <div role="group" aria-label="มุมมองอัลบั้ม" className="flex gap-0.5 rounded-sm bg-cream-100 p-[3px]">
      {(
        [
          ["grid", "ตาราง"],
          ["detail", "รายละเอียด"],
        ] as const
      ).map(([v, label]) => {
        const on = view === v;
        return (
          <button
            key={v}
            type="button"
            aria-pressed={on}
            onClick={() => setView(v)}
            className={`h-auto min-h-0 rounded-[6px] px-2.5 py-1 text-xs ${
              on ? "bg-white font-medium text-brown-900 shadow-[var(--shadow-card)]" : "text-ink-600"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
