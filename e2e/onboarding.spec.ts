import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

/**
 * Regression — คนที่ไม่ได้ตั้งครรภ์ก็ต้องสมัครจนจบได้
 *
 * ของเดิมขั้นที่สามเป็น "วันที่ตั้งครรภ์" ตรงๆ โดยไม่ถามก่อนว่าตั้งครรภ์ไหม
 * คนในครอบครัวที่แค่อยากบันทึกสุขภาพตัวเอง (พ่อ ยาย) จึงไม่รู้ว่าต้องกรอกอะไร
 * — มีลิงก์ "ยังไม่ทราบ ข้ามไปก่อน" ตัวเล็กๆ อยู่ แต่มันสื่อว่า "ยังไม่รู้วันที่"
 * ไม่ใช่ "ไม่ได้ตั้งครรภ์" ซึ่งคนละความหมายกัน
 */
test.describe.configure({ mode: "serial" });

test("เลือกว่ายังไม่ได้ตั้งครรภ์ แล้วสมัครจนจบได้โดยไม่ต้องกรอกวันที่", async ({ page }) => {
  await signUp(page, uniqueEmail("nopreg"), "พ่อบันทึกสุขภาพ");

  await page.getByRole("button", { name: "เริ่มเลย" }).click();
  await page.getByLabel("ชื่อครอบครัว").fill("ครอบครัวพ่อ");
  await page.getByRole("button", { name: "ถัดไป" }).click();

  await test.step("ต้องตอบคำถามก่อน จะข้ามไปเลยไม่ได้", async () => {
    await expect(page.getByRole("heading", { name: "ตอนนี้กำลังตั้งครรภ์ไหม" })).toBeVisible();
    await expect(page.getByRole("button", { name: "ถัดไป" })).toBeDisabled();
    // ยังไม่เลือก = ยังไม่ต้องเห็นช่องวันที่
    await expect(page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/)).toHaveCount(0);
  });

  await test.step("เลือกว่ายังไม่ได้ตั้งครรภ์ ช่องวันที่ต้องไม่โผล่", async () => {
    await page.getByRole("button", { name: "ยังไม่ได้ตั้งครรภ์" }).click();
    await expect(page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/)).toHaveCount(0);
    await expect(page.getByText(/เพิ่มข้อมูลการตั้งครรภ์ภายหลังได้/)).toBeVisible();
    await expect(page.getByRole("button", { name: "ถัดไป" })).toBeEnabled();
  });

  await test.step("สรุปแล้วเริ่มใช้งานได้ ไม่มีข้อมูลตั้งครรภ์ค้างมา", async () => {
    await page.getByRole("button", { name: "ถัดไป" }).click();
    await expect(page.getByText(/ยังไม่ได้ตั้งครรภ์ — เพิ่มข้อมูลภายหลังได้/)).toBeVisible();
    await expect(page.getByText("วันคาดคลอด")).toHaveCount(0);
    await page.getByRole("button", { name: "เริ่มใช้ Pre Care" }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  await test.step("หน้าแรกต้องไม่พัง และชวนให้เพิ่มข้อมูลตั้งครรภ์เมื่อพร้อม", async () => {
    // ไม่มีแถบอายุครรภ์ (progressbar มีเฉพาะตอนรู้วันตั้งครรภ์แล้ว)
    await expect(page.getByRole("progressbar")).toHaveCount(0);
    await expect(page.getByText("ตั้งค่าวันตั้งครรภ์")).toBeVisible();
    await expect(page.getByRole("link", { name: "ตั้งค่าตอนนี้" })).toBeVisible();
    // ส่วนที่ไม่เกี่ยวกับการตั้งครรภ์ต้องใช้ได้ตามปกติ
    await expect(page.getByRole("link", { name: "นับแคล" }).first()).toBeVisible();
  });

  await test.step("เปลี่ยนใจกลับไปเลือกว่าตั้งครรภ์ ช่องวันที่ต้องกลับมา", async () => {
    await page.goto("/onboarding");
    // ครอบครัวมีแล้ว ระบบพากลับเข้าแอป ไม่ต้องตั้งใหม่
    await expect(page).not.toHaveURL(/\/onboarding/, { timeout: 15_000 });
  });
});
