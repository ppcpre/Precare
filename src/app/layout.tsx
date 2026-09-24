import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

/**
 * ฟอนต์เก็บไว้ในรีโปเอง ไม่ดึงจาก Google ตอน build
 *
 * `next/font/google` ต้องวิ่งไปโหลดไฟล์ฟอนต์ทุกครั้งที่ build — วัดแล้วรอบนึง
 * ใช้เวลา 15 นาที 24 วินาที โดยกิน CPU แค่ 36 วินาที (นั่งรอเน็ต 14 นาทีครึ่ง)
 * พอถอดออก build เหลือ 11 วินาที ค่านี้จ่ายซ้ำทุกครั้งทั้งในเครื่องและบน CI
 *
 * ใช้ไฟล์แบบ variable สองก้อน (ไทย + ละติน) แทนของเดิมที่เป็นน้ำหนักละไฟล์
 * รวมสองก้อนแค่ 57 KB และครอบคลุมน้ำหนัก 100–900 ทั้งช่วง
 *
 * แยกเป็นสองชุดตามตัวอักษร ไม่รวมเป็นชุดเดียว เพราะ next/font/local ใส่
 * unicode-range ต่อไฟล์ไม่ได้ ถ้ายัดสองไฟล์ในชุดเดียวกัน ไฟล์หลังจะทับไฟล์แรก
 * แล้วตัวอักษรไทยหายทั้งแอป — วางเป็นลำดับ font-family ให้เบราว์เซอร์ไล่เอง
 * ปลอดภัยกว่าและได้ผลเหมือนกัน
 *
 * Noto Sans Thai อยู่ภายใต้ SIL Open Font License 1.1 (ดู src/app/fonts/OFL.txt)
 */
const fontThai = localFont({
  src: "./fonts/noto-sans-thai-thai.woff2",
  weight: "100 900",
  variable: "--font-thai",
  display: "swap",
});

const fontLatin = localFont({
  src: "./fonts/noto-sans-thai-latin.woff2",
  weight: "100 900",
  variable: "--font-latin",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pre Care — Health Care",
  description: "ดูแลการตั้งครรภ์ไปด้วยกันทั้งครอบครัว",
  /**
   * iOS ไม่อ่าน display: standalone จาก manifest — ต้องใช้แท็ก apple เฉพาะ
   * ถ้าไม่มี การเพิ่มลงจอโฮมบน iPhone จะเปิดใน Safari พร้อมแถบ URL เหมือนเดิม
   * และ **Web Push บน iOS ใช้ไม่ได้เลยถ้าไม่ได้เปิดแบบ standalone**
   */
  appleWebApp: {
    capable: true,
    title: "Pre Care",
    // default = แถบสถานะพื้นสว่างตัวหนังสือดำ เข้ากับพื้นครีมของแอป
    statusBarStyle: "default",
  },
  /**
   * Next เขียน meta ชื่อมาตรฐาน `mobile-web-app-capable` ให้อย่างเดียว
   * iOS ตั้งแต่ 16.4 อ่าน display: standalone จาก manifest ได้แล้วจึงพอ
   * แต่เครื่องที่เก่ากว่านั้นรู้จักแค่ชื่อเดิมของ Apple — เติมไว้ไม่เสียอะไร
   */
  other: { "apple-mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  themeColor: "#FDFBF7",
  viewportFit: "cover", // ให้ bottom nav เว้น safe area บนเครื่องที่มี home indicator
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={`${fontThai.variable} ${fontLatin.variable}`}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
