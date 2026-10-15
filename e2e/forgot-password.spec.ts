import { expect, test } from "@playwright/test";
import { gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — ลืมรหัสผ่าน
 *
 * ชุดเทสต์นี้ครอบเส้นทางที่ทดสอบได้โดยไม่ต้องมีกล่องจดหมายจริง:
 * หน้าเข้าถึงได้โดยไม่ต้องล็อกอิน · ตอบข้อความเดียวกันเสมอไม่ว่าอีเมลจะมีบัญชี
 * หรือไม่ · ลิงก์ที่ใช้ไม่ได้ต้องบอกให้ขอใหม่ ไม่ใช่โชว์ฟอร์มที่กดแล้วพัง
 *
 * การส่งอีเมลจริงยืนยันด้วยมือหลังตั้ง secret ของ Brevo (ดู docs/project-plan.md)
 */
test.describe.configure({ mode: "serial" });

test("ขอลิงก์รีเซ็ตได้โดยไม่ต้องล็อกอิน และไม่บอกว่าอีเมลไหนมีบัญชี", async ({ page }) => {
  const real = uniqueEmail("forgot");
  await signUp(page, real, "แม่ลืมรหัส");
  await page.context().clearCookies();

  await test.step("หน้าเข้าสู่ระบบมีทางไปลืมรหัสผ่าน", async () => {
    await gotoApp(page, "/login");
    await page.getByRole("link", { name: "ลืมรหัสผ่าน?" }).click();
    await expect(page).toHaveURL(/\/forgot$/);
  });

  /**
   * จุดสำคัญ: ถ้าคำตอบต่างกันระหว่างอีเมลที่มีบัญชีกับไม่มี หน้านี้จะกลายเป็น
   * เครื่องมือไล่เดาว่าใครเป็นสมาชิก ซึ่งในแอปที่เก็บข้อมูลการตั้งครรภ์
   * แค่รู้ว่า "คนนี้มีบัญชี" ก็เป็นข้อมูลที่เจ้าตัวอาจยังไม่อยากให้ใครรู้
   */
  await test.step("อีเมลที่มีบัญชีจริง", async () => {
    await page.getByLabel("อีเมล").fill(real);
    await page.getByRole("button", { name: "ส่งลิงก์ให้ฉัน" }).click();
    await expect(page.getByText("ถ้ามีบัญชีของอีเมลนี้ เราส่งลิงก์ไปแล้ว")).toBeVisible({
      timeout: 30_000,
    });
  });

  await test.step("อีเมลที่ไม่มีบัญชี ต้องได้ข้อความเดียวกันเป๊ะ", async () => {
    await gotoApp(page, "/forgot");
    await page.getByLabel("อีเมล").fill("ไม่มีใครใช้-xyz@example.test");
    await page.getByRole("button", { name: "ส่งลิงก์ให้ฉัน" }).click();
    await expect(page.getByText("ถ้ามีบัญชีของอีเมลนี้ เราส่งลิงก์ไปแล้ว")).toBeVisible({
      timeout: 30_000,
    });
  });
});

test("ลิงก์ที่ใช้ไม่ได้ ต้องบอกให้ขอใหม่ ไม่ใช่โชว์ฟอร์มที่กดแล้วพัง", async ({ page }) => {
  await test.step("ไม่มี token เลย", async () => {
    await gotoApp(page, "/reset-password");
    await expect(page.getByText("ลิงก์ใช้ไม่ได้แล้ว")).toBeVisible();
    await expect(page.getByRole("link", { name: "ขอลิงก์ใหม่" })).toBeVisible();
  });

  await test.step("better-auth ส่งกลับมาพร้อม error", async () => {
    await gotoApp(page, "/reset-password?error=INVALID_TOKEN");
    await expect(page.getByText("ลิงก์ใช้ไม่ได้แล้ว")).toBeVisible();
  });

  await test.step("token ปลอม — ฟอร์มขึ้น แต่กดแล้วต้องบอกว่าใช้ไม่ได้", async () => {
    await gotoApp(page, "/reset-password?token=ไม่ใช่ของจริง");
    await page.getByLabel("รหัสผ่านใหม่", { exact: true }).fill("ChaoPhraya!4269");
    await page.getByLabel("ยืนยันรหัสผ่านใหม่").fill("ChaoPhraya!4269");
    await page.getByRole("button", { name: "ตั้งรหัสผ่านใหม่แล้วเข้าสู่ระบบ" }).click();
    await expect(page.getByText(/ลิงก์นี้ใช้ไม่ได้แล้ว/)).toBeVisible({ timeout: 30_000 });
  });
});
