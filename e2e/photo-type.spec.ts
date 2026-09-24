import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, makePng, pickFiles, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — แก้ประเภทไฟล์จากหน้าดูรูป
 *
 * ประเภทเป็นตัวกรองของอัลบั้มด้วย การแก้ที่ไม่ทำให้ตัวกรองเห็นตามจึงเท่ากับ
 * ไฟล์หายไปจากที่ที่ผู้ใช้เพิ่งย้ายมันไป เทสต์นี้จึงเช็คถึงหน้าอัลบั้ม
 * ไม่ใช่แค่ป้ายบนหน้ารูปเปลี่ยน
 */
test.describe.configure({ mode: "serial" });

test("เปลี่ยนประเภทไฟล์ได้ และตัวกรองในอัลบั้มเห็นตาม", async ({ page }) => {
  await signUp(page, uniqueEmail("ptype"), "แม่จัดประเภท");
  await completeOnboarding(page, "ครอบครัวจัดประเภท");

  await test.step("อัปรูปเป็นอัลตราซาวด์ไว้ก่อน", async () => {
    await gotoApp(page, "/album/upload");
    await pickFiles(page, [
      { name: "u.png", mimeType: "image/png", buffer: makePng(900, 700, 5) },
    ]);
    await page.getByRole("button", { name: "อัลตราซาวด์", exact: true }).click();
    await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
    await page.waitForURL(/\/album$/, { timeout: 45_000 });
  });

  await test.step("เปิดรูปแล้วเปลี่ยนเป็นเอกสาร", async () => {
    await page.locator('img[src*="/photos/"]').first().click();
    await page.waitForURL(/\/album\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await expect(page.getByText("อัลตราซาวด์").first()).toBeVisible();

    await page.getByRole("button", { name: "เอกสาร", exact: true }).click();
    // ป้ายบนหัวเรื่องต้องเปลี่ยนตาม ไม่ใช่แค่ชิปที่กดเปลี่ยนสี
    await expect(page.getByText("เอกสาร").first()).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() =>
        page.getByRole("button", { name: "เอกสาร", exact: true }).getAttribute("aria-pressed"),
      )
      .toBe("true");
  });

  await test.step("ตัวกรองในอัลบั้มเห็นตาม", async () => {
    await page.goto("/album?type=document");
    await expect(page.locator('img[src*="/photos/"]')).toHaveCount(1);

    await page.goto("/album?type=ultrasound");
    await expect(page.locator('img[src*="/photos/"]')).toHaveCount(0);
  });
});

test("หน้าดูรูปของคนที่แก้ไขได้ ต้องมีปุ่มเปลี่ยนประเภทครบทุกตัวเลือก", async ({ page }) => {
  // สิทธิ์จริงอยู่ที่ editorAction ฝั่ง server (scripts/check-authz.mjs คุมอยู่)
  // ตรงนี้เช็คว่า UI ให้ทางเลือกครบตามที่ประกาศไว้ที่เดียวใน lib/photo-types
  await signUp(page, uniqueEmail("ptypeall"), "แม่ครบตัวเลือก");
  await completeOnboarding(page, "ครอบครัวครบตัวเลือก");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [{ name: "v.png", mimeType: "image/png", buffer: makePng(700, 500, 6) }]);
  await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  await page.locator('img[src*="/photos/"]').first().click();
  await page.waitForURL(/\/album\/[0-9a-f-]{36}/, { timeout: 30_000 });

  for (const label of ["อัลตราซาวด์", "ครอบครัว", "เอกสาร", "อื่นๆ"]) {
    await expect(page.getByRole("button", { name: label, exact: true })).toBeVisible();
  }
});
