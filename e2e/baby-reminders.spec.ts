import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * ไทม์ไลน์ 7 วัน + การแจ้งเตือน (หลังคลอด รอบ 2)
 *
 * ของที่ unit test จับไม่ได้:
 * - ทางเข้าจากหน้าวันนี้ (กระดิ่ง / ปฏิทิน) ไปถึงจริง
 * - ตั้งเตือนแล้วการ์ดบอก "อีก … · HH:MM" จากบันทึกล่าสุด และปุ่มบนหน้าแรกมีกระดิ่ง
 * - ปิด/เปิด และลบได้จริง · เรื่องที่ตั้งแล้วตั้งซ้ำไม่ได้
 */
test("ไทม์ไลน์ 7 วัน และตั้งการแจ้งเตือน", async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page, uniqueEmail("babyremind"), "แม่ตั้งเตือน");
  await completeOnboarding(page, "ครอบครัวตั้งเตือน");

  await gotoApp(page, "/baby");
  await page.getByLabel("ชื่อที่เรียก").fill("น้องเตือน");
  await page.getByLabel("วันเกิด").fill(daysAgo(15));
  await page.getByRole("button", { name: "เพิ่มลูก" }).click();
  await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });
  const childId = new URL(page.url()).pathname.split("/")[2];

  await test.step("บันทึกผ้าอ้อมหนึ่งครั้งเป็นจุดตั้งต้น", async () => {
    await gotoApp(page, `/baby/${childId}/log`);
    await page.getByRole("button", { name: /^ผ้าอ้อม/ }).click();
    await page.getByRole("dialog", { name: "ผ้าอ้อม" }).getByRole("button", { name: /^ฉี่/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });
  });

  await test.step("ไทม์ไลน์: 7 แถว กรองประเภทได้ และบอกว่าไม่เทียบเกณฑ์", async () => {
    await page.getByRole("link", { name: "ไทม์ไลน์ 7 วัน" }).click();
    await page.waitForURL(/\/log\/week$/, { timeout: 30_000 });
    await expect(page.getByRole("img", { name: /มีบันทึก/ })).toHaveCount(7);
    await expect(page.getByText("7 วันนี้ เฉลี่ยต่อวัน")).toBeVisible();
    await expect(page.getByText(/ไม่ได้เทียบกับเกณฑ์/)).toBeVisible();

    await page.getByRole("link", { name: "นอน", exact: true }).click();
    await page.waitForURL(/k=sleep/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: "นอน", exact: true })).toHaveAttribute("aria-current", "page");
    await page.getByRole("link", { name: "สัปดาห์ก่อน" }).click();
    await page.waitForURL(/end=\d{4}-\d{2}-\d{2}/, { timeout: 30_000 });
    await expect(page.getByText("สัปดาห์นี้ยังไม่มีบันทึก")).toBeVisible();
  });

  await test.step("ยังไม่มีการแจ้งเตือน → ตั้งเตือนผ้าอ้อม 2 ชม.", async () => {
    await gotoApp(page, `/baby/${childId}/log`);
    await page.getByRole("link", { name: "การแจ้งเตือน" }).click();
    await page.waitForURL(/\/reminders$/, { timeout: 30_000 });
    await expect(page.getByText("ยังไม่ได้ตั้งการแจ้งเตือน")).toBeVisible();
    await expect(page.getByText(/เตือนเฉพาะเครื่องของคุณ/)).toBeVisible();

    await page.getByRole("link", { name: "เพิ่มการแจ้งเตือน" }).click();
    await page.waitForURL(/\/reminders\/new$/, { timeout: 30_000 });
    await page.getByRole("button", { name: /^ผ้าอ้อม/ }).click();
    await page.getByRole("radio", { name: "2 ชม.", exact: true }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/reminders$/, { timeout: 30_000 });

    await expect(page.getByText("เปลี่ยนผ้าอ้อม")).toBeVisible();
    await expect(page.getByText(/^อีก .+ · /)).toBeVisible();
    await expect(page.getByText("ทุก 2 ชม. หลังครั้งล่าสุด")).toBeVisible();
    await expect(page.getByText("งดเตือน 23:00–07:00")).toBeVisible();
  });

  await test.step("ตั้งเรื่องเดิมซ้ำไม่ได้", async () => {
    await page.getByRole("link", { name: "เพิ่มการแจ้งเตือน" }).click();
    await page.waitForURL(/\/reminders\/new$/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: /^ผ้าอ้อม/ })).toBeDisabled();
    await page.getByRole("link", { name: "ปิด" }).click();
    await page.waitForURL(/\/reminders$/, { timeout: 30_000 });
  });

  await test.step("ปุ่มผ้าอ้อมบนหน้าแรกมีกระดิ่ง", async () => {
    await gotoApp(page, "/dashboard");
    const region = page.getByRole("region", { name: "บันทึกของน้องเตือน" });
    await expect(region.getByLabel("ตั้งเตือนไว้")).toHaveCount(1);
  });

  await test.step("ปิดแล้วขึ้นว่าปิดอยู่ · แก้แล้วลบได้", async () => {
    await gotoApp(page, `/baby/${childId}/reminders`);
    const sw = page.getByRole("switch", { name: "เตือนเปลี่ยนผ้าอ้อม" });
    await sw.click();
    await expect(sw).toHaveAttribute("aria-checked", "false", { timeout: 15_000 });
    await expect(page.getByText("ปิดอยู่")).toBeVisible();

    await page.getByRole("link", { name: "แก้การแจ้งเตือนเปลี่ยนผ้าอ้อม" }).click();
    await page.waitForURL(/\/reminders\/[0-9a-f-]+$/, { timeout: 30_000 });
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "ลบการแจ้งเตือนนี้" }).click();
    await page.waitForURL(/\/reminders$/, { timeout: 30_000 });
    await expect(page.getByText("ยังไม่ได้ตั้งการแจ้งเตือน")).toBeVisible();
  });
});
