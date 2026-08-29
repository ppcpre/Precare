import { defineConfig, devices } from "@playwright/test";

/**
 * E2E รันกับ workerd จริง ไม่ใช่ `next dev`
 *
 * เพราะตัวที่ deploy คือ worker ที่ OpenNext build ออกมา ไม่ใช่ Next dev server
 * เคยเจอมาแล้วว่า self-fetch ไป /api/auth/get-session ทำงานใน dev แต่เงียบบน
 * Workers — ถ้าเทสต์รันบน dev server จะไม่มีวันจับได้
 *
 * แลกมาด้วยเวลา build ~15 วินาทีก่อนเริ่ม ซึ่งรับได้
 */
const PORT = 8788;

export default defineConfig({
  testDir: "./e2e",
  // เทสต์เขียนบน D1 ตัวเดียวกัน รันขนานกันแล้วข้อมูลชนกัน
  workers: 1,
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["github"], ["list"]] : [["list"]],
  timeout: 60_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
  },

  projects: [
    // ขนาดจอมือถือเป็นหลัก เพราะแอปออกแบบ mobile-first
    { name: "mobile", use: { ...devices["Pixel 7"] } },
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
  ],

  webServer: {
    /**
     * migrate ก่อนเสมอ — บน CI ยังไม่มี D1 local เลย ถ้าไม่รันตรงนี้
     * worker จะขึ้นได้แต่ทุกหน้าพังเพราะไม่มีตาราง
     *
     * ทุกค่าที่ส่งด้วย --var เป็นค่าสำหรับเทสต์เท่านั้น เพื่อให้เครื่อง dev
     * กับ CI ได้ผลเหมือนกัน และไม่ต้องพึ่ง .dev.vars ซึ่งไม่ได้ commit
     * - BETTER_AUTH_URL: Better Auth ตอบ "Invalid origin" ถ้า origin ไม่ตรง
     *   baseURL ส่วน .dev.vars ตั้งไว้เป็น :3000 สำหรับ `next dev`
     * - BETTER_AUTH_SECRET: ใช้เซ็นคุกกี้ของ worker ชั่วคราวตัวนี้เท่านั้น
     *   ฐานข้อมูลเป็น D1 local ที่ทิ้งได้ จึงไม่ใช่ความลับอะไร
     * - AUTH_RATE_LIMIT_MAX: ชุดเทสต์สมัคร/ล็อกอินหลายสิบครั้งในนาทีเดียว
     *   ซึ่งชน rate limit จริง (ดูเหตุผลเต็มใน src/lib/auth.ts)
     */
    command:
      `npx wrangler d1 migrations apply precare-db --local && ` +
      `npx opennextjs-cloudflare build && ` +
      `npx wrangler dev --port ${PORT} ` +
      `--var BETTER_AUTH_URL:http://localhost:${PORT} ` +
      `--var BETTER_AUTH_SECRET:e2e-only-not-a-real-secret-000000000000 ` +
      `--var AUTH_RATE_LIMIT_MAX:500`,
    url: `http://localhost:${PORT}/login`,
    reuseExistingServer: !process.env.CI,
    /**
     * เผื่อไว้มาก เพราะคำสั่งนี้ทำสามอย่างต่อกันบนฐานที่ว่างเปล่า
     * migrate ทุกไฟล์ + build worker ใหม่ทั้งก้อน + สตาร์ต wrangler
     * บน CI ที่ checkout ใหม่ทุกครั้งต้องจ่ายเต็มทุกรอบ และจะช้าลงเรื่อยๆ
     * ตามจำนวน migration ที่เพิ่มขึ้น เคยตั้งไว้ 240 วินาทีแล้วเกินจนล้มทั้งชุด
     * โดยขึ้น error ว่า webServer ไม่ยอมสตาร์ต ซึ่งชี้ไปผิดที่
     */
    timeout: 600_000,
    stdout: "pipe",
    stderr: "pipe",
  },
});
