import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — ส่วนสูง/น้ำหนักก่อนตั้งครรภ์ และประวัติการแก้
 *
 * สองค่านี้เป็นต้นทางของเกณฑ์น้ำหนักทั้งหมด แก้ทีเดียวช่วงเกณฑ์ขยับทั้งกราฟ
 * ในแอปที่คนทั้งครอบครัวเห็นข้อมูลเดียวกัน ต้องตอบได้ว่าใครแก้ตอนไหน
 */
test.describe.configure({ mode: "serial" });

test("กรอกส่วนสูง/น้ำหนัก แก้ได้ และมีประวัติว่าใครแก้จากอะไรเป็นอะไร", async ({ page }) => {
  await signUp(page, uniqueEmail("preg"), "แม่ชั่งน้ำหนัก");
  await completeOnboarding(page, "ครอบครัวชั่งน้ำหนัก");

  await test.step("กรอกครั้งแรก แล้วเห็น BMI กับช่วงเกณฑ์ทันที", async () => {
    await gotoApp(page, "/profile/pregnancy");
    await page.getByLabel("ส่วนสูง (ซม.)").fill("160");
    await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("52");

    // 52 / 1.6² = 20.3 → เกณฑ์ปกติ → 11.5-16 กก.
    await expect(page.getByText(/BMI ก่อนตั้งครรภ์/)).toContainText("20.3");
    await expect(page.getByText(/เกณฑ์ปกติ/)).toBeVisible();
    await expect(page.getByText(/11\.5–16 กก\./)).toBeVisible();

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  await test.step("ค่าที่กรอกต้องอยู่ครบเมื่อกลับมา", async () => {
    await gotoApp(page, "/profile/pregnancy");
    await expect(page.getByLabel("ส่วนสูง (ซม.)")).toHaveValue("160");
    await expect(page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)")).toHaveValue("52");
  });

  await test.step("แก้น้ำหนักแล้วช่วงเกณฑ์ขยับตาม", async () => {
    await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("70");
    // 70 / 1.6² = 27.3 → น้ำหนักเกิน → 7-11.5 กก.
    await expect(page.getByText(/น้ำหนักเกิน/)).toBeVisible();
    await expect(page.getByText(/7–11\.5 กก\./)).toBeVisible();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  await test.step("ประวัติบอกว่าใครแก้ จากอะไรเป็นอะไร", async () => {
    await gotoApp(page, "/profile/pregnancy");
    const history = page.getByText("ประวัติการแก้ไข").locator("..");
    await expect(history).toContainText("น้ำหนักก่อนตั้งครรภ์: 52 กก. → 70 กก.");
    await expect(history).toContainText("แม่ชั่งน้ำหนัก");
    // ครั้งแรกที่กรอกก็ต้องถูกบันทึกด้วย ไม่ใช่เฉพาะการแก้ครั้งหลัง
    await expect(history).toContainText("ยังไม่ได้กรอก → 160 ซม.");
  });
});

/**
 * Regression — การ์ดน้ำหนักในหน้าสุขภาพ
 *
 * การ์ดนี้บอกคนท้องว่าน้ำหนักตัวเอง "อยู่ในช่วงที่คาดไว้" หรือไม่ ถ้าแสดงผิด
 * จะทำให้กังวลโดยไม่จำเป็น หรือแย่กว่านั้นคือสบายใจทั้งที่ควรไปหาหมอ
 */
test("การ์ดน้ำหนักชวนให้กรอกข้อมูลที่ขาด แล้วแสดงผลเทียบเกณฑ์เมื่อข้อมูลครบ", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("wcard"), "แม่ดูกราฟ");
  await completeOnboarding(page, "ครอบครัวดูกราฟ");

  await test.step("ยังไม่มีส่วนสูง/น้ำหนัก = ชวนให้ใส่ ไม่ใช่คำนวณมั่ว", async () => {
    await gotoApp(page, "/health");
    await expect(page.getByText("น้ำหนักเทียบเกณฑ์")).toBeVisible();
    await expect(page.getByRole("link", { name: "ใส่ข้อมูล" })).toBeVisible();
  });

  await test.step("ใส่ข้อมูลแล้วยังไม่เคยชั่ง = ชวนให้บันทึก", async () => {
    await page.getByRole("link", { name: "ใส่ข้อมูล" }).click();
    await page.getByLabel("ส่วนสูง (ซม.)").fill("160");
    await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("52");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await gotoApp(page, "/health");
    await expect(page.getByText(/บันทึกน้ำหนักสักครั้ง/)).toBeVisible();
    await expect(page.getByText(/11\.5–16 กก\./)).toBeVisible();
  });

  await test.step("บันทึกน้ำหนักแล้วการ์ดเทียบเกณฑ์ให้เห็น", async () => {
    await gotoApp(page, "/health/new");
    await page.getByLabel(/น้ำหนัก/).first().fill("58.4");
    await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
    await page.waitForURL(/\/health(\?|$)/, { timeout: 30_000 });

    // อายุครรภ์ 24 สัปดาห์ (ตั้งค่าโดย completeOnboarding) เพิ่ม 6.4 กก.
    await expect(page.getByText(/เพิ่มมาแล้ว/)).toContainText("6.4");
    await expect(page.getByText(/อยู่ในช่วงที่คาดไว้/)).toBeVisible();
    await expect(page.getByText(/ครรภ์เดี่ยว ไม่ใช่คำวินิจฉัย/)).toBeVisible();
  });
});
