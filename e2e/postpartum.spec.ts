import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  daysAgo,
  expectWeek,
  gotoApp,
  signUp,
  uniqueEmail,
} from "./helpers";

/**
 * Regression — สวิตช์ "คลอดแล้ว"
 *
 * ปุ่มนี้มีอยู่เพื่อหยุดสิ่งที่กลายเป็นผิดหลังคลอด ถ้าวันหนึ่งมีคนเผลอทำให้
 * การ์ดใดการ์ดหนึ่งกลับมาขึ้น ผู้ใช้จะเห็น "อายุครรภ์ 45 สัปดาห์" และโดนชวน
 * นับลูกดิ้นทั้งที่คลอดไปแล้ว — ซึ่งไม่มีใครรายงานบั๊กแบบนี้ ได้แต่เลิกใช้แอป
 *
 * เทสต์นี้จึงเช็คของที่ต้อง **หายไป** เป็นหลัก ไม่ใช่ของที่ขึ้นมาใหม่
 */
test("กดว่าคลอดแล้ว: หยุดนับอายุครรภ์ ซ่อนการ์ดที่ไม่เกี่ยวแล้ว และกดกลับได้", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("pp"), "แม่คลอดแล้ว");
  await completeOnboarding(page, "ครอบครัวคลอดแล้ว");

  /**
   * เลื่อนครรภ์ไป 37 สัปดาห์
   *
   * onboarding ตั้งไว้ที่ 24 ซึ่งการ์ดนับลูกดิ้น (เริ่ม 28) และจับเวลาการบีบตัว
   * (เริ่ม 36) ยังไม่ขึ้น — ถ้าเทสต์ที่สัปดาห์ 24 มันจะ "ผ่าน" เพราะการ์ดไม่เคย
   * ขึ้นตั้งแต่แรก ไม่ใช่เพราะสวิตช์ทำงาน ซึ่งคือเทสต์ปลอม
   */
  await test.step("เลื่อนไป 37 สัปดาห์ ให้การ์ดที่ต้องหายขึ้นมาก่อน", async () => {
    await gotoApp(page, "/profile/pregnancy");
    await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(daysAgo(259));
    await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expectWeek(page, 37);
    await expect(page.getByText("นับลูกดิ้น")).toBeVisible();
    await expect(page.getByText("จับเวลาการบีบตัว")).toBeVisible();
  });

  await test.step("กราฟน้ำหนักเทียบเกณฑ์ขึ้นอยู่ตอนยังตั้งครรภ์", async () => {
    await gotoApp(page, "/health");
    await expect(page.getByText("น้ำหนักเทียบเกณฑ์")).toBeVisible();
  });

  await test.step("ต้องยืนยันก่อน ไม่ใช่กดทีเดียวแล้วเปลี่ยนเลย", async () => {
    await gotoApp(page, "/profile/pregnancy");
    await expect(page.getByText("สถานะ: กำลังตั้งครรภ์")).toBeVisible();
    await page.getByRole("button", { name: "บันทึกว่าคลอดแล้ว" }).click();
    await expect(page.getByText(/ข้อมูลที่บันทึกไว้ไม่ถูกลบ/)).toBeVisible();
    await page.getByRole("button", { name: "ยืนยัน" }).click();
    await expect(page.getByText("สถานะ: คลอดแล้ว")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("หน้าแรกหยุดนับ และการ์ดที่ไม่เกี่ยวแล้วหายไป", async () => {
    await gotoApp(page, "/dashboard");
    await expect(page.getByRole("progressbar", { name: /สัปดาห์ที่/ })).toHaveCount(0);
    await expect(page.getByText("นับลูกดิ้น")).toHaveCount(0);
    await expect(page.getByText("จับเวลาการบีบตัว")).toHaveCount(0);
    // และต้องไม่กลับไปขอให้ "ตั้งค่าวันตั้งครรภ์" เหมือนลืมทุกอย่างที่ผ่านมา
    await expect(page.getByText("ตั้งค่าวันตั้งครรภ์")).toHaveCount(0);
    await expect(page.getByText("บันทึกไว้ว่าคลอดแล้ว")).toBeVisible();
  });

  await test.step("ข้อความต้องเป็นกลาง ไม่แสดงความยินดี ไม่ถือว่ามีลูกแล้ว", async () => {
    // การตั้งครรภ์ไม่ได้จบด้วยลูกเสมอไป คนที่เพิ่งสูญเสียก็กดปุ่มนี้
    const body = await page.locator("main").innerText();
    for (const word of ["ยินดี", "ลูกน้อย", "สมาชิกใหม่"]) {
      expect(body, `หน้าแรกหลังคลอดต้องไม่มีคำว่า "${word}"`).not.toContain(word);
    }
  });

  await test.step("กราฟน้ำหนักเทียบเกณฑ์ IOM หายไปด้วย — เป็นเกณฑ์ของคนที่ยังท้องอยู่", async () => {
    await gotoApp(page, "/health");
    await expect(page.getByText("น้ำหนักเทียบเกณฑ์")).toHaveCount(0);
    // แต่บันทึกเก่าต้องยังอยู่ ไม่ได้หายไปไหน
    await expect(page.getByRole("heading", { name: "บันทึกสุขภาพ" }).first()).toBeVisible();
  });

  await test.step("มีประวัติว่าใครกดเปลี่ยน — คนอื่นในบ้านต้องตามได้", async () => {
    await gotoApp(page, "/profile/pregnancy");
    // แถวในประวัติมีรูปแบบ "สถานะ: กำลังตั้งครรภ์ → คลอดแล้ว"
    const row = page
      .getByRole("listitem")
      .filter({ hasText: "สถานะ: กำลังตั้งครรภ์ → คลอดแล้ว" })
      .first();
    await expect(row).toBeVisible();
    // และต้องบอกได้ว่าใครกด ไม่ใช่แค่ว่าเปลี่ยนแล้ว
    await expect(row).toContainText("แม่คลอดแล้ว");
  });

  await test.step("กดกลับได้ ทุกอย่างกลับมาเหมือนเดิม", async () => {
    await page.getByRole("button", { name: /กดผิด/ }).click();
    await expect(page.getByText("สถานะ: กำลังตั้งครรภ์")).toBeVisible({ timeout: 30_000 });
    await gotoApp(page, "/dashboard");
    await expectWeek(page, 37);
    await expect(page.getByText("นับลูกดิ้น")).toBeVisible();
    await expect(page.getByText("จับเวลาการบีบตัว")).toBeVisible();
  });
});
