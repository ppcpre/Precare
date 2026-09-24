"use client";

import { useEffect, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";

/** ระยะที่ต้องลากให้ถึงก่อนปล่อย ถึงจะนับว่าสั่งรีเฟรช */
const TRIGGER = 72;
/** ตัวชี้หยุดขยับที่ระยะนี้ ลากต่อก็ไม่ไปไกลกว่านี้ */
const MAX = 96;
/** หน่วงให้รู้สึกว่ามีแรงต้าน ลาก 2 ส่วนตัวชี้ลง 1 ส่วน */
const RESIST = 0.5;
/** ต่ำกว่านี้ถือว่าเป็นการแตะ ไม่ใช่การลาก — กันไม่ให้แตะแล้วหน้าเลื่อนกระตุก */
const SLOP = 8;

/**
 * ลากลงเพื่อโหลดหน้าใหม่ — ของเราเอง ไม่ใช่ของเบราว์เซอร์
 *
 * ทำเองเพราะท่านี้ของเบราว์เซอร์หายไปตอนลงหน้าโฮมเป็นแอป (display: standalone)
 * บน iOS ไม่มีแถบ address ให้กดโหลดใหม่ด้วย = ไม่มีทางรีเฟรชเลยนอกจากปิดแอปเปิดใหม่
 *
 * globals.css ตั้ง overscroll-behavior-y: contain ไว้เพื่อปิดท่าของ Chrome
 * บน Android ไม่งั้นลากทีเดียวจะรีเฟรชซ้อนกันสองที
 */
export function PullToRefresh() {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  // อ่านค่าล่าสุดใน event handler ที่ผูกไว้ครั้งเดียว — state ใน closure จะค้างอยู่ที่ค่าแรก
  const busy = useRef(false);

  useEffect(() => {
    // จอที่ไม่มีนิ้ว (เดสก์ท็อป) ไม่ต้องผูก listener ให้เปลือง
    if (!window.matchMedia("(pointer: coarse)").matches) return;

    let startY = 0;
    let startX = 0;
    let pulling = false;
    let dist = 0;

    /**
     * อยู่บนสุดจริงไหม
     *
     * เช็คแค่ window.scrollY ไม่พอ — ถ้านิ้วอยู่ในกล่องที่เลื่อนได้ของตัวเอง
     * (แถบเลือกกลุ่ม, ชีทที่เลื่อนในตัว) แล้วกล่องนั้นเลื่อนลงไปแล้ว
     * การลากลงคือการเลื่อนกล่องกลับขึ้น ไม่ใช่การสั่งรีเฟรช
     */
    const atTop = (target: EventTarget | null) => {
      if (window.scrollY > 0) return false;
      let el = target instanceof Element ? target : null;
      while (el) {
        if (el.scrollHeight > el.clientHeight + 1) {
          const overflow = getComputedStyle(el).overflowY;
          if ((overflow === "auto" || overflow === "scroll") && el.scrollTop > 0) return false;
        }
        el = el.parentElement;
      }
      return true;
    };

    const onStart = (e: TouchEvent) => {
      // สองนิ้วขึ้นไปคือซูม ไม่ใช่ลากลง
      if (busy.current || e.touches.length !== 1 || !atTop(e.target)) return;
      startY = e.touches[0].clientY;
      startX = e.touches[0].clientX;
      pulling = true;
      dist = 0;
    };

    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      const dx = e.touches[0].clientX - startX;
      // ปัดขึ้น หรือปัดแนวนอน (สไลด์รูป/ปฏิทิน) — ยกเลิก ปล่อยให้หน้าทำงานปกติ
      if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) {
        pulling = false;
        dist = 0;
        setPull(0);
        return;
      }
      if (dy < SLOP) return;
      dist = Math.min(MAX, dy * RESIST);
      // ต้อง preventDefault ไม่งั้นหน้าจะเด้ง (rubber band) สวนทางกับตัวชี้ที่เราวาดเอง
      // ผูก listener แบบ passive: false ไว้แล้ว ถึงเรียกตรงนี้ได้
      e.preventDefault();
      setPull(dist);
    };

    const onEnd = () => {
      if (!pulling) return;
      pulling = false;
      if (dist >= TRIGGER) {
        busy.current = true;
        setRefreshing(true);
        // ให้เบราว์เซอร์วาดวงหมุนสักเฟรมก่อน ไม่งั้นกดแล้วเหมือนไม่มีอะไรเกิดขึ้น
        requestAnimationFrame(() => requestAnimationFrame(() => window.location.reload()));
        return;
      }
      setPull(0);
    };

    /**
     * กลับมาด้วยปุ่ม back จาก bfcache หน้าจะกลับมาทั้งสภาพเดิม
     * รวมถึงวงหมุนที่ค้างอยู่ตอนออกไป ต้องเคลียร์เอง
     */
    const onShow = () => {
      busy.current = false;
      setRefreshing(false);
      setPull(0);
    };

    document.addEventListener("touchstart", onStart, { passive: true });
    document.addEventListener("touchmove", onMove, { passive: false });
    document.addEventListener("touchend", onEnd, { passive: true });
    document.addEventListener("touchcancel", onEnd, { passive: true });
    window.addEventListener("pageshow", onShow);
    return () => {
      document.removeEventListener("touchstart", onStart);
      document.removeEventListener("touchmove", onMove);
      document.removeEventListener("touchend", onEnd);
      document.removeEventListener("touchcancel", onEnd);
      window.removeEventListener("pageshow", onShow);
    };
  }, []);

  const active = refreshing || pull > 0;
  const progress = Math.min(1, pull / TRIGGER);
  const y = refreshing ? TRIGGER : pull;

  return (
    <>
      <div
        aria-hidden
        data-testid="ptr-indicator"
        data-ready={pull >= TRIGGER ? "true" : "false"}
        className="pointer-events-none fixed top-0 left-1/2 z-50 flex size-10 items-center justify-center rounded-full border border-cream-200 bg-white shadow-[var(--shadow-card)]"
        style={{
          transform: `translate(-50%, ${y - 48}px)`,
          opacity: active ? Math.max(0.35, progress) : 0,
          // ตอนลากต้องตามนิ้วทันที ใส่ transition แล้วจะหน่วงตามหลังนิ้ว
          transition: pull > 0 ? "none" : "transform .2s ease, opacity .2s ease",
        }}
      >
        <RefreshCw
          size={18}
          strokeWidth={2}
          className={`text-brown-700 ${refreshing ? "animate-spin" : ""}`}
          style={refreshing ? undefined : { transform: `rotate(${progress * 270}deg)` }}
        />
      </div>
      {/* คนใช้ screen reader ไม่เห็นวงหมุน ต้องบอกด้วยข้อความ */}
      <span role="status" className="sr-only">
        {refreshing ? "กำลังโหลดหน้าใหม่" : ""}
      </span>
    </>
  );
}
