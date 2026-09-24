import type { MetadataRoute } from "next";

/**
 * Web App Manifest — ทำให้ติดตั้งลงจอโฮมได้
 *
 * ⚠️ ต้องเปิดให้เข้าถึงโดยไม่ล็อกอิน (ดู PUBLIC_PREFIXES ใน src/middleware.ts)
 *
 * เบราว์เซอร์ดึงไฟล์นี้ **โดยไม่ส่ง cookie** (แท็ก link rel="manifest" ไม่มี
 * crossorigin="use-credentials") ถ้าไม่เปิดเป็น public middleware จะเห็นว่า
 * ไม่มี session แล้วพาไป /login — การติดตั้งจะพังทั้งที่ผู้ใช้ล็อกอินอยู่
 * เป็นกับดักเดียวกับที่เคยเจอกับหน้า /legal
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Pre Care — ดูแลการตั้งครรภ์ไปด้วยกันทั้งครอบครัว",
    short_name: "Pre Care",
    description:
      "บันทึกสุขภาพ นัดหมาย อัลบั้ม และการนับลูกดิ้น ให้คนในครอบครัวดูร่วมกันได้",
    lang: "th",
    dir: "ltr",
    start_url: "/",
    // scope ครอบทั้งเว็บ ลิงก์ภายในจึงเปิดในแอปที่ติดตั้งไว้ ไม่เด้งออกเบราว์เซอร์
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#FDFBF7",
    // ให้เท่ากับ viewport.themeColor ใน layout — ถ้าไม่ตรงกัน แถบสถานะจะเปลี่ยนสี
    // ตอนเปิดแอปขึ้นมา ดูเหมือนหน้าจอกระพริบ
    theme_color: "#FDFBF7",
    categories: ["health", "medical", "lifestyle"],
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      /**
       * maskable แยกไฟล์ เพราะ Android ครอปไอคอนเป็นทรงของเครื่องเอง
       * (วงกลม สี่เหลี่ยมมน หยดน้ำ แล้วแต่ยี่ห้อ) ไฟล์ชุดนี้จึงเผื่อขอบไว้ 20%
       * และพื้นเต็มจอไม่มีมุมโค้ง ถ้าใช้ไฟล์เดียวกับ any โลโก้จะโดนตัดมุม
       */
      { src: "/icon-maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
