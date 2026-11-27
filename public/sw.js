/**
 * Service Worker — รับ push แล้วเด้งแจ้งเตือน
 *
 * ⚠️ ไฟล์นี้ **ไม่ cache อะไรเลย** โดยตั้งใจ
 *
 * การ cache หน้าเว็บที่ล็อกอินแล้ว หรือรูปจาก /api/media เท่ากับเอาบันทึกสุขภาพ
 * รูปอัลตราซาวด์ และใบเสร็จที่มีชื่อคนไข้ไปเก็บไว้ในเครื่อง ซึ่งต้องเขียนไว้ใน
 * นโยบายความเป็นส่วนตัวและต้องล้างตอนออกจากระบบ — ยังไม่ทำ จึงยังไม่ cache
 *
 * push ที่ได้รับ **ไม่มีเนื้อหา** (ดูเหตุผลใน src/lib/push.ts)
 * จึงต้องมาถามเซิร์ฟเวอร์ของเราเองว่ามีอะไรจะเตือน โดยแนบ cookie ของผู้ใช้ไปด้วย
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  event.waitUntil(
    (async () => {
      let title = "Pre Care";
      let body = "มีนัดหมายใกล้ถึงแล้ว";
      let url = "/appointments";

      try {
        // credentials: "include" จำเป็น — ไม่งั้นจะได้ 401 แล้วขึ้นข้อความกลางๆ แทน
        const res = await fetch("/api/push/next", { credentials: "include" });
        if (res.ok) {
          const d = await res.json();
          if (d && d.title) {
            title = d.title;
            body = d.body || body;
            url = d.url || url;
          }
        }
      } catch {
        // เน็ตไม่ดีตอน push มาถึง — ยังต้องเด้งข้อความกลางๆ ให้
        // iOS บังคับว่าต้องแสดงการแจ้งเตือนทุกครั้งที่รับ push ถ้าไม่แสดงจะโดนตัดสิทธิ์
      }

      await self.registration.showNotification(title, {
        body,
        icon: "/icon-192.png",
        badge: "/icon-192.png",
        // tag เดียวกันทับของเก่า ไม่ให้การแจ้งเตือนซ้อนกันเป็นตั้ง
        tag: "precare-reminder",
        data: { url },
      });
    })(),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/appointments";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      // ถ้าแอปเปิดอยู่แล้วให้โฟกัสหน้าต่างเดิม ไม่เปิดใหม่ซ้อน
      for (const c of all) {
        if ("focus" in c) {
          await c.focus();
          if ("navigate" in c) await c.navigate(url);
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
