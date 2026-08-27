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

/**
 * Regression — ปุ่มเพิ่มบนหน้า list ต้องไม่โผล่คู่กับ FAB บนมือถือ
 *
 * cn() เป็นแค่ join ไม่ได้ merge class ที่ชนกัน การใส่ hidden ทับ inline-flex
 * ของปุ่มจึงไม่ได้ผล ลำดับใน CSS เป็นตัวตัดสิน ทำให้ทั้งสามหน้ามี CTA ซ้ำ
 */
test("มือถือเห็น FAB อย่างเดียว เดสก์ท็อปเห็นปุ่มบนหัวข้ออย่างเดียว", async ({ page }, testInfo) => {
  await signUp(page, uniqueEmail("cta"), "แม่ซีทีเอ");
  await completeOnboarding(page, "ครอบครัวซีทีเอ");

  const mobile = testInfo.project.name === "mobile";
  // fab เขียนแยกเพราะ aria-label ของ FAB ไม่ได้ตรงกับข้อความบนปุ่มเสมอไป
  const pages: { path: string; title: string; label: string; fab: string }[] = [
    { path: "/health", title: "บันทึกสุขภาพ", label: "เพิ่มบันทึก", fab: "เพิ่มบันทึกสุขภาพ" },
    { path: "/appointments", title: "นัดหมายแพทย์", label: "เพิ่มนัดหมาย", fab: "เพิ่มนัดหมาย" },
    { path: "/album", title: "อัลบั้ม", label: "เพิ่มรูป", fab: "เพิ่มรูป" },
  ];

  for (const { path, title, label, fab: fabLabel } of pages) {
    await page.goto(path);
    // จำกัดขอบเขตไว้ที่แถวหัวข้อ ไม่งั้นไปชนกับลิงก์ชื่อเดียวกันใน empty state
    const headerRow = page.getByRole("heading", { name: title, exact: true }).locator("..");
    const topButton = headerRow.getByRole("link", { name: label });
    const fab = page.locator(`a.fixed[aria-label="${fabLabel}"]`);

    if (mobile) {
      await expect(topButton, `${path} มือถือไม่ควรมีปุ่มบนหัวข้อ`).toHaveCount(0);
      await expect(fab, `${path} มือถือควรมี FAB`).toBeVisible();
    } else {
      await expect(topButton, `${path} เดสก์ท็อปควรมีปุ่มบนหัวข้อ`).toBeVisible();
      await expect(fab, `${path} เดสก์ท็อปไม่ควรมี FAB`).toBeHidden();
    }
  }
});
