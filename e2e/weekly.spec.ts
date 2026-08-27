import { expect, test } from "@playwright/test";
import { completeOnboarding, signUp, uniqueEmail } from "./helpers";

/**
 * Phase 2 — การ์ดขนาดและพัฒนาการรายสัปดาห์
 *
 * onboarding ใน helper ตั้ง LMP ย้อนหลัง 168 วัน = 24 สัปดาห์ 0 วันพอดี
 * เนื้อหาที่คาดหวังจึงตรึงไว้ที่สัปดาห์ 24 ได้
 */
test("หน้าแรกแสดงขนาดและพัฒนาการของสัปดาห์ปัจจุบัน", async ({ page }) => {
  await signUp(page, uniqueEmail("weekly"), "แม่รายสัปดาห์");
  await completeOnboarding(page, "ครอบครัวรายสัปดาห์");

  await expect(page.getByRole("heading", { name: "ขนาดของลูกน้อย" })).toBeVisible();
  await expect(page.getByText("ข้าวโพด")).toBeVisible();
  await expect(page.getByText("30 ซม.")).toBeVisible();
  await expect(page.getByText("600 ก.")).toBeVisible();

  await expect(page.getByRole("heading", { name: "พัฒนาการของหนูน้อย" })).toBeVisible();
  await expect(page.getByText(/ปอดพัฒนาครบโครงสร้างแล้ว/)).toBeVisible();

  // ข้อมูลทางการแพทย์ต้องมีข้อความกำกับเสมอ ไม่ใช่ทางเลือก
  await expect(page.getByText(/เป็นค่าเฉลี่ยเพื่อการอ้างอิงเท่านั้น/)).toBeVisible();
  await expect(page.getByText(/ไม่ใช่คำแนะนำทางการแพทย์/)).toBeVisible();
});

test("ยังไม่มีไฟล์รูปใน R2 ต้องขึ้นไอคอนแทน ไม่ใช่รูปพัง", async ({ page }) => {
  await signUp(page, uniqueEmail("fallback"), "แม่ฟอลแบ็ก");
  await completeOnboarding(page, "ครอบครัวฟอลแบ็ก");

  const card = page.getByRole("heading", { name: "ขนาดของลูกน้อย" }).locator("..");

  // route ต้องตอบ 404 จริง (ยังไม่ได้ใส่ไฟล์) ไม่ใช่พังด้วย 500
  const res = await page.request.get("/api/asset/weekly/size/w24.webp");
  expect(res.status()).toBe(404);

  // แล้ว UI ต้องสลับไปไอคอนเอง ไม่เหลือ <img> ที่โหลดไม่ขึ้นค้างไว้
  await expect(card.locator('img[src*="/api/asset/"]')).toHaveCount(0);
  await expect(card.locator("svg").first()).toBeVisible();
});

test("รูปประกอบต้อง cache แบบ public ได้ ต่างจากรูปของผู้ใช้", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("assetcache"), "แม่แคช");
  await completeOnboarding(page, "ครอบครัวแคช");

  // /api/asset ไม่มีข้อมูลผู้ใช้ จึงต้องเปิดได้โดยไม่ต้องล็อกอิน
  // (ตรงข้ามกับ /api/media ที่ต้อง 401)
  const anon = await browser.newContext();
  const res = await anon.request.get("http://localhost:8788/api/asset/weekly/size/w24.webp");
  expect(res.status()).not.toBe(401);
  expect(res.status()).not.toBe(302);
  await anon.close();
});
