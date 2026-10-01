import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — นัดที่ผ่านไปแล้ววันนี้ ต้องไม่ค้างในแท็บ "กำลังจะถึง"
 *
 * appt_datetime เก็บเป็นเวลาไทยแบบไม่มี timezone แต่โค้ดเดิมเทียบกับ UTC
 * ไทยเร็วกว่า 7 ชั่วโมง นัดที่เพิ่งผ่านไปจึงยังถูกนับว่ายังไม่ถึงได้นานถึง 7 ชม.
 * — โผล่บนหน้าแรกว่าเป็นนัดถัดไป และค้างในแท็บกำลังจะถึง
 *
 * เทสต์นี้สร้างนัดเมื่อ 2 ชั่วโมงที่แล้วตามเวลาเครื่อง (เทสต์ตั้ง timezone เป็น
 * Asia/Bangkok ใน playwright.config.ts) ซึ่งเป็นช่วงที่บั๊กเดิมยังนับว่าเป็นอนาคต
 */
test.describe.configure({ mode: "serial" });

const pad = (n: number) => String(n).padStart(2, "0");

test("นัดที่ผ่านไปสองชั่วโมงต้องอยู่แท็บผ่านมาแล้ว ไม่ใช่กำลังจะถึง", async ({ page }) => {
  await signUp(page, uniqueEmail("appttime"), "แม่เวลา");
  await completeOnboarding(page, "ครอบครัวเวลา");

  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
  const date = `${twoHoursAgo.getFullYear()}-${pad(twoHoursAgo.getMonth() + 1)}-${pad(twoHoursAgo.getDate())}`;
  const time = `${pad(twoHoursAgo.getHours())}:${pad(twoHoursAgo.getMinutes())}`;

  await gotoApp(page, "/appointments/new");
  await page.getByLabel("วันที่").fill(date);
  await page.getByLabel("เวลา").fill(time);
  await page.getByLabel("หัวข้อนัด").fill("นัดที่ผ่านไปแล้ว");
  await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
  await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });

  await test.step("แท็บกำลังจะถึงต้องไม่มีนัดนี้", async () => {
    await page.goto("/appointments");
    await expect(page.getByText("นัดที่ผ่านไปแล้ว")).toHaveCount(0);
  });

  await test.step("แท็บผ่านมาแล้วต้องมี", async () => {
    await page.goto("/appointments?tab=past");
    await expect(page.getByText("นัดที่ผ่านไปแล้ว")).toBeVisible();
  });

  await test.step("หน้าแรกต้องไม่โชว์นัดที่ผ่านไปแล้วว่าเป็นนัดถัดไป", async () => {
    await page.goto("/dashboard");
    await expect(page.getByText("นัดที่ผ่านไปแล้ว")).toHaveCount(0);
  });
});
