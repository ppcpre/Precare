import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, signUp, uniqueEmail } from "./helpers";

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
  // ห้ามใส่คำว่า "เวลา" ในชื่อ — ลิงก์โปรไฟล์มี aria-label ว่า "โปรไฟล์ของ <ชื่อ>"
  // แล้ว getByLabel("เวลา") จะไปโดนลิงก์นั้นด้วย
  await signUp(page, uniqueEmail("appttime"), "แม่นัดย้อนหลัง");
  await completeOnboarding(page, "ครอบครัวนัดย้อนหลัง");

  const twoHoursAgo = new Date(Date.now() - 2 * 3600_000);
  const date = `${twoHoursAgo.getFullYear()}-${pad(twoHoursAgo.getMonth() + 1)}-${pad(twoHoursAgo.getDate())}`;
  const time = `${pad(twoHoursAgo.getHours())}:${pad(twoHoursAgo.getMinutes())}`;

  await gotoApp(page, "/appointments/new");
  await page.getByLabel("วันที่", { exact: true }).fill(date);
  await page.getByLabel("เวลา", { exact: true }).fill(time);
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

/**
 * Regression — นัดของเมื่อวาน ต้องไม่ขึ้นป้าย "วันนี้"
 *
 * ของเดิมนับวันด้วย Math.ceil((appt - now) / 86400000) ซึ่งคืน -0 สำหรับนัดที่
 * ผ่านไปแล้วไม่ถึง 24 ชั่วโมง และ `-0 < 0` เป็น false นัดเมื่อวานจึงตกไปเข้า
 * เงื่อนไข "วันนี้" ทั้งป้ายบนการ์ดและหัวกลุ่ม (เจอจริงเช้าวันที่ 10 ต.ค. 69)
 *
 * บวกกับการที่ `new Date("2026-10-09T08:00:00")` ตีความตาม timezone ของเครื่อง
 * ซึ่งบน worker คือ UTC เวลานัดจึงเลื่อนไปอีก 7 ชั่วโมง
 */
test("นัดของเมื่อวานต้องขึ้นว่าผ่านมาแล้ว ไม่ใช่วันนี้", async ({ page }) => {
  await signUp(page, uniqueEmail("apptday"), "แม่ดูป้ายวัน");
  await completeOnboarding(page, "ครอบครัวดูป้ายวัน");

  await gotoApp(page, "/appointments/new");
  await page.getByLabel("วันที่", { exact: true }).fill(daysAgo(1));
  await page.getByLabel("เวลา", { exact: true }).fill("08:00");
  await page.getByLabel("หัวข้อนัด").fill("นัดของเมื่อวาน");
  await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
  await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });

  await page.goto("/appointments?tab=past");
  const card = page.getByText("นัดของเมื่อวาน").locator("xpath=ancestor::*[self::div][3]");
  await expect(page.getByText("นัดของเมื่อวาน")).toBeVisible({ timeout: 30_000 });

  await test.step("ป้ายบนการ์ดต้องเป็น ผ่านมาแล้ว", async () => {
    await expect(card.getByText("ผ่านมาแล้ว").first()).toBeVisible();
    await expect(card.getByText("วันนี้")).toHaveCount(0);
  });

  await test.step("หัวกลุ่มต้องไม่ใช่ วันนี้", async () => {
    await expect(page.getByRole("heading", { name: "วันนี้" })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: "ผ่านมาแล้ว" })).toBeVisible();
  });
});
