"use client";

import { useSyncExternalStore } from "react";

/**
 * เวลาปัจจุบันที่อัปเดตเองทุกวินาที
 *
 * ใช้ useSyncExternalStore แทน useEffect + setState ด้วยเหตุผลเดียวกับ NotifyBanner
 * — เวลาเป็นของนอก React การ setState ใน effect ทำให้ render ซ้อนโดยไม่จำเป็น
 * (react-hooks/set-state-in-effect) และ Date.now() ใน render ผิด react-hooks/purity
 *
 * ใช้ store เดียวร่วมกันทั้งแอป ต่อให้มีหลาย component เรียกก็มี interval เดียว
 */
const listeners = new Set<() => void>();
let timer: ReturnType<typeof setInterval> | null = null;
let now = 0;

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!timer) {
    now = Date.now();
    timer = setInterval(() => {
      now = Date.now();
      listeners.forEach((l) => l());
    }, 1000);
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0 && timer) {
      clearInterval(timer);
      timer = null;
    }
  };
}

/** ฝั่ง server คืน 0 — component ต้องรองรับกรณียังไม่มีเวลา ไม่ใช่คำนวณจาก 0 ตรงๆ */
export const useNow = () => useSyncExternalStore(subscribe, () => now, () => 0);
