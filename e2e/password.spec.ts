import { expect, test } from "@playwright/test";
import { PASSWORD, completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — เปลี่ยนรหัสผ่าน
 *
 * ของที่ถ้าผิดแล้วเสียหายจริง: รหัสเก่ายังใช้ได้ทั้งที่เปลี่ยนไปแล้ว หรือ
 * เครื่องอื่นที่เคยเข้าไว้ยังค้างอยู่ — คนเปลี่ยนรหัสเพราะกลัวมีคนเข้าถึงบัญชีได้
 * ถ้าสองข้อนี้ไม่จริง การเปลี่ยนรหัสก็เป็นแค่พิธีกรรม
 */
test.describe.configure({ mode: "serial" });

const NEW_PASSWORD = "ChaoPhraya!4269";

test("เปลี่ยนรหัสผ่านแล้วรหัสเก่าใช้ไม่ได้ และเครื่องอื่นหลุด", async ({ page, browser }) => {
  const email = uniqueEmail("pwd");
  await signUp(page, email, "แม่เปลี่ยนรหัส");
  await completeOnboarding(page, "ครอบครัวเปลี่ยนรหัส");

  // เครื่องที่สองที่ล็อกอินค้างไว้ก่อนเปลี่ยนรหัส
  const other = await browser.newContext();
  const otherPage = await other.newPage();
  await gotoApp(otherPage, "/login");
  await otherPage.getByLabel("อีเมล", { exact: true }).fill(email);
  await otherPage.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await otherPage.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await otherPage.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await test.step("เมนูเปลี่ยนรหัสผ่านอยู่ในหน้าโปรไฟล์", async () => {
    await gotoApp(page, "/profile");
    await page.getByRole("link", { name: "เปลี่ยนรหัสผ่าน" }).click();
    await expect(page).toHaveURL(/\/profile\/password$/);
  });

  await test.step("กรอกรหัสปัจจุบันผิด ต้องไม่เปลี่ยนให้", async () => {
    await page.getByLabel("รหัสผ่านปัจจุบัน").fill("ผิดแน่นอน12345");
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(page.getByText("รหัสผ่านปัจจุบันไม่ถูกต้อง")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("รหัสใหม่ที่เดาง่ายต้องถูกปัดตั้งแต่ในเครื่อง", async () => {
    await page.getByLabel("รหัสผ่านปัจจุบัน").fill(PASSWORD);
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("password123");
    await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill("password123");
    await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(page.getByText(/เดาง่ายเกินไป/)).toBeVisible();
  });

  await test.step("กรอกถูกครบ เปลี่ยนสำเร็จ", async () => {
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill(NEW_PASSWORD);
    await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill(NEW_PASSWORD);
    await page.getByRole("button", { name: "บันทึกรหัสผ่านใหม่" }).click();
    await expect(page.getByText(/เปลี่ยนรหัสผ่านเรียบร้อย/)).toBeVisible({ timeout: 30_000 });
  });

  await test.step("เครื่องนี้ยังใช้งานต่อได้ ไม่ถูกเตะออกไปด้วย", async () => {
    await gotoApp(page, "/dashboard");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  await test.step("เครื่องอื่นที่ค้างไว้ต้องหลุด", async () => {
    await otherPage.goto("/dashboard");
    await expect(otherPage).toHaveURL(/\/login/, { timeout: 30_000 });
  });

  await test.step("รหัสเก่าเข้าไม่ได้อีก แต่รหัสใหม่เข้าได้", async () => {
    await otherPage.goto("/login");
    await otherPage.getByLabel("อีเมล", { exact: true }).fill(email);
    await otherPage.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
    await otherPage.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await expect(otherPage).not.toHaveURL(/\/dashboard/, { timeout: 15_000 });

    await otherPage.getByLabel("รหัสผ่าน", { exact: true }).fill(NEW_PASSWORD);
    await otherPage.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    await otherPage.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  await other.close();
});
