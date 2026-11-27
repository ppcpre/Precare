import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAhead, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * การแจ้งเตือนแบบปิดแอปแล้วยังเตือนได้
 *
 * เทสต์นี้ไม่ได้ส่ง push จริง — ต้องมีเซิร์ฟเวอร์ push ของ Google/Apple
 * และคีย์ส่วนตัวซึ่งอยู่ใน secret ไม่ได้อยู่ในเครื่องที่รันเทสต์
 * (ความถูกต้องของลายเซ็น VAPID คุมด้วย test/push.test.ts ซึ่งตรวจลายเซ็นจริง)
 *
 * ที่คุมตรงนี้คือสิ่งที่พังแล้วผู้ใช้จะไม่รู้ตัว: service worker โหลดไม่ได้
 * และปลายทางที่ service worker ไปถามรายละเอียดต้องกันคนนอกได้จริง
 */
test("service worker โหลดได้ และปลายทางที่มันเรียกกันคนนอกได้", async ({ page, browser }) => {
  await test.step("ไฟล์ service worker ต้องเสิร์ฟได้โดยไม่ล็อกอิน", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get("http://localhost:8788/sw.js");
    expect(res.status(), "เบราว์เซอร์โหลด sw.js ก่อนล็อกอินได้เสมอ").toBe(200);
    expect(res.headers()["content-type"]).toContain("javascript");

    // ต้องไม่ cache อะไรเลยตามที่ตั้งใจ — ถ้าวันหนึ่งมีใครเติม cache เข้าไป
    // ต้องมาคิดเรื่องข้อมูลสุขภาพที่ค้างในเครื่องก่อน
    const body = await res.text();
    expect(body).not.toContain("caches.open");
    await ctx.close();
  });

  await test.step("คนไม่ได้ล็อกอินถามรายละเอียดการเตือนไม่ได้", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get("http://localhost:8788/api/push/next");
    expect(res.status()).toBe(401);
    await ctx.close();
  });

  await signUp(page, uniqueEmail("push"), "แม่เปิดเตือน");
  await completeOnboarding(page, "ครอบครัวเปิดเตือน");

  await test.step("เจ้าของได้รายละเอียดนัดถัดไปของตัวเอง", async () => {
    await gotoApp(page, "/appointments/new");
    await page.getByLabel("วันที่").fill(daysAhead(2));
    await page.getByLabel("เวลา").fill("09:30");
    await page.getByLabel("หัวข้อนัด").fill("ตรวจครรภ์แจ้งเตือน");
    await page.getByLabel("สถานที่").fill("รพ. ตัวอย่าง");
    await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
    await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });

    const res = await page.request.get("http://localhost:8788/api/push/next");
    expect(res.status()).toBe(200);
    const d = (await res.json()) as { title?: string; body?: string; url?: string };
    expect(d.title).toContain("ตรวจครรภ์แจ้งเตือน");
    expect(d.body).toContain("09:30");
    expect(d.url).toBe("/appointments");
  });

  await test.step("คนในครอบครัวอื่นไม่เห็นนัดของเรา", async () => {
    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signUp(other, uniqueEmail("pushother"), "คนอื่นเตือน");
    await completeOnboarding(other, "ครอบครัวคนอื่นเตือน");
    const res = await other.request.get("http://localhost:8788/api/push/next");
    expect(res.status()).toBe(200);
    expect(await res.json()).toEqual({});
    await ctx.close();
  });

  await test.step("หน้าโปรไฟล์มีปุ่มเปิดการแจ้งเตือน", async () => {
    await gotoApp(page, "/profile");
    await expect(page.getByRole("button", { name: /เปิดการแจ้งเตือน/ })).toBeVisible();
  });
});
