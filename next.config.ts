import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ไม่ใช้ output: "export" อีกแล้ว — เดิมเป็น static export สำหรับ Firebase Hosting
  // ตอนนี้รัน SSR บน Cloudflare Workers ผ่าน @opennextjs/cloudflare
  // better-auth ลาก adapter ทุกตัวมาเป็น dependency แต่เราใช้แค่ drizzle
  // kysely อย่างเดียว 3.4 MB — ต้อง stub ทิ้งเพราะเพดาน worker มีแค่ 3 MiB (gzip)
  turbopack: {
    resolveAlias: {
      kysely: "./src/stubs/kysely.ts",
      "@better-auth/kysely-adapter": "./src/stubs/kysely-adapter.ts",
    },
  },
  /**
   * T6.5 — security headers
   *
   * ไม่ใส่ CSP แบบเข้มใน Phase 1 เพราะ Next ฉีด inline script/style ของตัวเอง
   * การทำให้ถูกต้องต้องใช้ nonce ผ่าน middleware ซึ่งบน edge runtime มีข้อจำกัด
   * — ยกไป Phase 2 พร้อมกับ Web Push ที่ต้องแตะ middleware อยู่แล้ว
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // กันเว็บอื่นเอาแอปเราไปฝัง iframe แล้วหลอกให้คลิก
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
          // กันเบราว์เซอร์เดาชนิดไฟล์เอง เช่น มองรูปที่ผู้ใช้อัปโหลดเป็น script
          { key: "X-Content-Type-Options", value: "nosniff" },
          // ไม่ส่ง URL เต็มไปเว็บอื่น — URL ของเรามี id ของบันทึกสุขภาพอยู่
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-DNS-Prefetch-Control", value: "off" },
          {
            key: "Permissions-Policy",
            // ปิดทุกอย่างที่แอปไม่ได้ใช้ · camera ปล่อยไว้เพราะจะใช้ตอนถ่ายรูปอัปโหลด
            value: "geolocation=(), microphone=(), payment=(), usb=(), interest-cohort=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
      {
        // ห้าม CDN หรือ proxy ไหนเก็บ response ของ API ไว้แจกซ้ำ
        source: "/api/:path*",
        headers: [{ key: "Cache-Control", value: "private, no-store" }],
      },
    ];
  },

  images: {
    // next/image ยังไม่มี loader ของ Cloudflare ที่ใช้ฟรีได้ — Phase 1 ใช้รูปที่ resize มาแล้ว
    unoptimized: true,
  },
};

export default nextConfig;

// ทำให้ `next dev` เข้าถึง binding ของ Cloudflare (D1/R2) ได้เหมือนตอน deploy จริง
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
