import type { Metadata, Viewport } from "next";
import { Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  subsets: ["thai", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-noto-sans-thai",
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
    <html lang="th" className={notoSansThai.variable}>
      <body className="font-sans">{children}</body>
    </html>
  );
}
