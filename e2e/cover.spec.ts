import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, makePng, pickFiles, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — รูปหน้าปกของการ์ดอายุครรภ์
 *
 * เส้นทางนี้พังเงียบได้หลายจุดและ unit test มองไม่เห็นสักจุด:
 * - cover ผูกกับ photos ผ่าน FK ถ้า migration ไม่มี ON DELETE SET NULL การลบรูปจะพัง
 * - การ์ดอ่าน r2Key ของวิดีโอไปใส่ <img> ตรงๆ ได้ (ต้องใช้ thumbKey)
 * - รูปโหลดไม่ขึ้นจะเห็นเป็นกรอบเปล่า ไม่ใช่ error — เลยเช็ค naturalWidth ไม่ใช่แค่ว่ามี <img>
 */
test.describe.configure({ mode: "serial" });

test("ตั้งรูปในอัลบั้มเป็นรูปหน้าปก แล้วเอาออกได้", async ({ page }) => {
  await signUp(page, uniqueEmail("cover"), "แม่หน้าปก");
  await completeOnboarding(page, "ครอบครัวหน้าปก");

  const hero = page.locator('img[src*="/photos/"]').first();

  await test.step("ยังไม่ได้เลือก — การ์ดไม่มีรูป แต่มีทางเข้า", async () => {
    await expect(page.getByRole("link", { name: "เลือกรูปหน้าปกจากอัลบั้ม" })).toBeVisible();
    await expect(hero).toHaveCount(0);
  });

  await test.step("อัปรูปเข้าอัลบั้มก่อน", async () => {
    await gotoApp(page, "/album/upload");
    await pickFiles(page, [
      { name: "cover.png", mimeType: "image/png", buffer: makePng(900, 700, 3) },
    ]);
    await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
    await page.waitForURL(/\/album$/, { timeout: 45_000 });
  });

  await test.step("กดเข้าไปที่รูป แล้วตั้งเป็นหน้าปก", async () => {
    // คลิกที่ไทล์รูป ไม่ใช่ a[href^="/album/"] ตัวแรก — ตัวนั้นคือปุ่ม "เพิ่มไฟล์" ที่ชี้ /album/upload
    await page.locator('img[src*="/photos/"]').first().click();
    await page.waitForURL(/\/album\/[0-9a-f-]{36}/, { timeout: 30_000 });
    await page.getByRole("button", { name: "ตั้งเป็นรูปหน้าปกหน้าแรก" }).click();
    await expect(page.getByText("รูปหน้าปกหน้าแรก", { exact: true })).toBeVisible({ timeout: 30_000 });
  });

  await test.step("หน้าแรกขึ้นรูปจริง ไม่ใช่กรอบเปล่า", async () => {
    await page.goto("/dashboard");
    await expect(hero).toBeVisible({ timeout: 30_000 });
    await expect
      .poll(() => hero.evaluate((el: HTMLImageElement) => el.naturalWidth), { timeout: 30_000 })
      .toBeGreaterThan(0);
    // เลขสัปดาห์ต้องยังอยู่ ไม่ใช่ถูกรูปทับหาย
    await expect(page.getByText("24", { exact: true }).first()).toBeVisible();
  });

  await test.step("เอาออกแล้วการ์ดกลับไปเป็นแบบเดิม", async () => {
    await page.goBack();
    await page.getByRole("button", { name: "เอาออกจากรูปหน้าปก" }).click();
    await expect(page.getByText("รูปหน้าปกหน้าแรก", { exact: true })).toHaveCount(0, { timeout: 30_000 });
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "เลือกรูปหน้าปกจากอัลบั้ม" })).toBeVisible();
  });
});

test("ลบรูปที่เป็นหน้าปกอยู่ได้ และการ์ดไม่ค้างรูปที่ไม่มีแล้ว", async ({ page }) => {
  await signUp(page, uniqueEmail("coverdel"), "แม่ลบหน้าปก");
  await completeOnboarding(page, "ครอบครัวลบหน้าปก");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [
    { name: "c.png", mimeType: "image/png", buffer: makePng(900, 700, 4) },
  ]);
  await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  await page.locator('img[src*="/photos/"]').first().click();
  await page.waitForURL(/\/album\/[0-9a-f-]{36}/, { timeout: 30_000 });
  await page.getByRole("button", { name: "ตั้งเป็นรูปหน้าปกหน้าแรก" }).click();
  await expect(page.getByText("รูปหน้าปกหน้าแรก", { exact: true })).toBeVisible({ timeout: 30_000 });

  // จุดตาย: ถ้า FK เป็น NO ACTION ตามที่ drizzle generate ให้มา การลบจะโดนปฏิเสธที่ D1
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: "ลบรูปนี้" }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  await page.goto("/dashboard");
  await expect(page.locator('img[src*="/photos/"]')).toHaveCount(0);
  await expect(page.getByRole("link", { name: "เลือกรูปหน้าปกจากอัลบั้ม" })).toBeVisible();
});
