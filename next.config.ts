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
  images: {
    // next/image ยังไม่มี loader ของ Cloudflare ที่ใช้ฟรีได้ — Phase 1 ใช้รูปที่ resize มาแล้ว
    unoptimized: true,
  },
};

export default nextConfig;

// ทำให้ `next dev` เข้าถึง binding ของ Cloudflare (D1/R2) ได้เหมือนตอน deploy จริง
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
void initOpenNextCloudflareForDev();
