"use client";

import { useEffect, useRef } from "react";

export type Reminder = {
  id: string;
  title: string;
  /** เวลาที่ควรเด้งเตือน (epoch ms) */
  at: number;
  /** ข้อความบรรทัดสอง */
  body: string;
};

const FIRED_KEY = "precare.firedReminders";
/** setTimeout เกิน ~24.8 วันจะ overflow เป็นเลขติดลบแล้วยิงทันที */
const MAX_DELAY = 24 * 60 * 60 * 1000;

function alreadyFired(id: string) {
  try {
    return (JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]") as string[]).includes(id);
  } catch {
    return false;
  }
}
function markFired(id: string) {
  try {
    const list = JSON.parse(localStorage.getItem(FIRED_KEY) ?? "[]") as string[];
    localStorage.setItem(FIRED_KEY, JSON.stringify([...list.slice(-49), id]));
  } catch {
    /* localStorage เต็มหรือถูกปิด — ไม่ใช่เรื่องคอขาดบาดตาย ปล่อยผ่าน */
  }
}

/**
 * T5.10 — เตือนนัดหมายด้วย Browser Notification
 *
 * ⚠️ ข้อจำกัดที่ยอมรับใน Phase 1: ทำงานเฉพาะตอนแท็บเปิดอยู่เท่านั้น
 *    ปิดแท็บแล้ว timer หายไปด้วย — การเตือนแบบปิดแอปแล้วยังเตือนได้
 *    ต้องใช้ Web Push + Service Worker (Phase 2)
 *
 * กันเตือนซ้ำด้วยการจำ id ที่ยิงไปแล้วใน localStorage
 * เพราะทุกครั้งที่เปลี่ยนหน้า component นี้ mount ใหม่
 */
export function AppointmentReminders({ reminders }: { reminders: Reminder[] }) {
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;

    for (const r of reminders) {
      const delay = r.at - Date.now();
      if (delay <= 0 || delay > MAX_DELAY) continue;
      if (alreadyFired(r.id)) continue;

      timers.current.push(
        setTimeout(() => {
          if (alreadyFired(r.id)) return;
          markFired(r.id);
          new Notification(r.title, { body: r.body, tag: r.id, icon: "/icon.png" });
        }, delay),
      );
    }

    const list = timers.current;
    return () => {
      list.forEach(clearTimeout);
      timers.current = [];
    };
  }, [reminders]);

  return null;
}
