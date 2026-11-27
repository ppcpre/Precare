"use client";

import { useEffect } from "react";
import { shouldReload } from "@/lib/build-skew";

/** กันรีโหลดวน — เก็บในแท็บ ไม่ใช่ข้ามแท็บ เพราะแต่ละแท็บถือบันเดิลของตัวเอง */
const FLAG = "precare-build-reloaded";

/**
 * โหลดหน้าใหม่เองเมื่อเซิร์ฟเวอร์เปลี่ยนบิลด์ไปแล้ว
 *
 * แอปที่ติดไว้หน้าจอโฮมเปิดค้างได้เป็นวันโดยไม่เคยโหลดหน้าใหม่ พอ deploy
 * บิลด์ใหม่ ปุ่มที่กดจะยิงไปหา Server Action รหัสเก่าที่เซิร์ฟเวอร์ไม่มีแล้ว
 * แล้วขึ้นข้อความภาษาอังกฤษว่า "An unexpected response was received from the
 * server." ซึ่งบอกผู้ใช้ไม่ได้เลยว่าต้องทำอะไร (เจอจริงตอนอัปโหลดรูป)
 *
 * เช็คตอนกลับมาที่แอป ไม่ใช่ตั้งเวลาเช็คเป็นระยะ — จังหวะที่คนกลับมาใช้คือ
 * จังหวะเดียวที่การรีโหลดไม่ขัดจังหวะอะไร และไม่กินโควตา request ตอนไม่ได้ใช้
 */
export function BuildWatch() {
  useEffect(() => {
    const check = async () => {
      if (document.visibilityState !== "visible") return;
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const { id } = (await res.json()) as { id?: unknown };
        const reloadedBefore = sessionStorage.getItem(FLAG) === "1";
        if (shouldReload({ mine: process.env.NEXT_PUBLIC_BUILD_ID, theirs: id, reloadedBefore })) {
          sessionStorage.setItem(FLAG, "1");
          location.reload();
        }
      } catch {
        // เน็ตหลุดหรือเซิร์ฟเวอร์ล่ม — ไม่ใช่เรื่องที่ต้องรบกวนผู้ใช้
      }
    };

    void check();
    document.addEventListener("visibilitychange", check);
    return () => document.removeEventListener("visibilitychange", check);
  }, []);

  return null;
}
