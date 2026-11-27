/// <reference types="@cloudflare/vitest-pool-workers/types" />

import type { D1Migration } from "@cloudflare/vitest-pool-workers";

/**
 * v0.22 เปลี่ยนมา type `env` เป็น Cloudflare.Env (ตัวเดียวกับที่ wrangler types สร้าง)
 * ไม่ใช่ ProvidedEnv แบบเวอร์ชันเก่า — จึงต้อง augment ตรงนี้แทน
 * DB มาจาก cloudflare-env.d.ts อยู่แล้ว เพิ่มเฉพาะ binding ที่ใช้ในเทสต์
 */
declare global {
  namespace Cloudflare {
    interface Env {
      TEST_MIGRATIONS: D1Migration[];
    }
  }
}
