import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // ค่า default ของ Server Action คือ 1 MB ซึ่งน้อยกว่ารูปชุดเดียวที่ย่อแล้ว
    // (10 ใบ x ~300 KB) การอัปโหลดจะถูกปฏิเสธก่อนถึง action ด้วยซ้ำ
    serverActions: { bodySizeLimit: "20mb" },
  },
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
   * CSP แบบเข้ม (มี nonce) อยู่ใน src/middleware.ts แล้วตั้งแต่ T6.5
   * ต้องอยู่ที่นั่นเพราะ nonce ต้องสุ่มใหม่ทุก request ทำใน config ไม่ได้
   */
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          // กันเว็บอื่นเอาแอปเราไปฝัง iframe แล้วหลอกให้คลิก
          // CSP เต็มรูปแบบอยู่ใน src/middleware.ts เพราะต้องใช้ nonce ต่อ request
          // ตรงนี้เหลือไว้เป็นตาข่ายสำหรับ path ที่ middleware ไม่ได้ครอบ (static asset)
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
