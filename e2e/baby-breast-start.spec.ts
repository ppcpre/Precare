import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, signUp, uniqueEmail } from "./helpers";

/** HH:MM ตามเวลาไทย ย้อนจากตอนนี้ — ตรงกับ timezoneId ใน playwright.config */
function bangkokHHMM(minutesAgo: number) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Bangkok",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(Date.now() - minutesAgo * 60_000));
}

/**
 * แก้เวลาเริ่มให้นม (ลืมกดเริ่มตอนลูกเริ่มดูด)
 *
 * unit test ของ shiftBreastStart คุมเลขแล้ว ที่นี่จับสิ่งที่ unit test ไม่เห็น:
 * - ตัวจับเวลาบนจอขยับทันทีที่แก้ ไม่ต้องรอ
 * - ค่าถูกบันทึกลง D1 จริง โหลดหน้าใหม่แล้วยังอยู่
 * - หยุดแล้วรายการที่บันทึกนับเวลาตามที่แก้
 */
test("แก้เวลาเริ่มให้นม: เลื่อนย้อน 15 นาที แล้วตัวจับเวลาและรายการตาม", async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page, uniqueEmail("breaststart"), "แม่แก้เวลา");
  await completeOnboarding(page, "ครอบครัวแก้เวลาเริ่ม");

  await gotoApp(page, "/baby");
  await page.getByLabel("ชื่อที่เรียก").fill("น้องเวลา");
  await page.getByLabel("วันเกิด").fill(daysAgo(10));
  await page.getByRole("button", { name: "เพิ่มลูก" }).click();
  await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });
  const childPath = new URL(page.url()).pathname;

  const left = page.getByRole("button", { name: /^ซ้าย/ });
  // เริ่ม hh:mm:00 ของ 15 นาทีก่อน → ผ่านมา 15:00–15:59 (+ เวลาที่เทสต์ใช้ไม่กี่วินาที)
  const shifted = /1[56]:\d\d/;
  const start = bangkokHHMM(15);

  await test.step("เริ่มซ้าย แล้วแก้เวลาเริ่ม — ตัวเลขขยับทันที", async () => {
    await gotoApp(page, `${childPath}/log/breast`);
    await left.click();
    // แถวเวลาเริ่มขึ้นเมื่อได้ id ของรอบจากเซิร์ฟเวอร์แล้ว — ปุ่มแสดงแค่ HH:MM
    const startRow = page.getByRole("button", { name: /^\d\d:\d\d$/ });
    await expect(startRow).toBeVisible({ timeout: 15_000 });
    await expect(left).toContainText(/0[01]:\d\d/);

    await startRow.click();
    // หน้าจอเดาก่อนแล้วค่อยยิง action — จับคำขอที่ fill นี้สร้าง แล้วรอคำตอบของมันเอง
    // (waitForResponse เฉยๆ อาจได้คำตอบของการแตะซ้ายเมื่อกี้ · ดู e2e-optimistic-write-race)
    const saved = page.waitForRequest((r) => r.method() === "POST" && !!r.headers()["next-action"]);
    await page.getByLabel("เริ่ม").fill(start);
    await expect(left).toContainText(shifted, { timeout: 5_000 });
    const res = await (await saved).response();
    expect(res?.status()).toBe(200);
  });

  await test.step("โหลดหน้าใหม่ — ค่ามาจาก D1 ไม่ใช่แค่บนจอ", async () => {
    await page.reload();
    await expect(left).toContainText(shifted, { timeout: 15_000 });
    await expect(left).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByRole("button", { name: start, exact: true })).toBeVisible();
  });

  await test.step("หยุดแล้วรายการนับตามเวลาที่แก้", async () => {
    await page.getByRole("button", { name: "หยุดและบันทึก" }).click();
    await page.waitForURL(/\/log$/, { timeout: 30_000 });
    await expect(page.getByText(/ซ้าย 1[56] น\./).first()).toBeVisible();
  });
});
