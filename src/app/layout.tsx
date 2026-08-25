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
