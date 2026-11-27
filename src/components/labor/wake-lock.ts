"use client";

import { useEffect, useRef } from "react";

/**
 * กันหน้าจอดับระหว่างจับเวลา
 *
 * ตอนเจ็บท้องไม่มีใครอยากปลดล็อกจอซ้ำๆ ทุกครั้งที่จะกดปุ่ม
 *
 * ⚠️ ต้องมีทางถอยเสมอ ไม่ใช่พังเงียบ — Wake Lock ใช้ได้บน Chrome Android
 *    และ Safari 16.4 ขึ้นไป เบราว์เซอร์ที่ไม่รองรับจะไม่มี navigator.wakeLock เลย
 *    และต่อให้มี ก็ถูกปฏิเสธได้ (แบตต่ำ, นโยบายของระบบ) จึงห่อ try/catch ทุกจุด
 *
 * ระบบปลด lock เองเมื่อผู้ใช้สลับแท็บ จึงต้องขอใหม่ตอนกลับมา
 * ไม่งั้นสลับไปเช็คอย่างอื่นแล้วกลับมา จอจะดับทั้งที่ยังจับเวลาอยู่
 */
export function useWakeLock(active: boolean) {
  const lock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;

    const request = async () => {
      if (cancelled || lock.current) return;
      try {
        lock.current = (await navigator.wakeLock?.request("screen")) ?? null;
        lock.current?.addEventListener("release", () => {
          lock.current = null;
        });
      } catch {
        // ไม่รองรับหรือถูกปฏิเสธ — จับเวลาต่อได้ตามปกติ แค่จอดับเองตามเดิม
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void request();
    };

    void request();
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisible);
      void lock.current?.release().catch(() => {});
      lock.current = null;
    };
  }, [active]);
}
