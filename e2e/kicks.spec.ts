import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * นับลูกดิ้น
 *
 * เน้นสิ่งที่พลาดแล้วอันตราย ไม่ใช่แค่ว่ากดแล้วเลขขึ้น
 * - รอบต้องรอดตอนปิดหน้าหรือเปลี่ยนอุปกรณ์ (เก็บฝั่งเซิร์ฟเวอร์จริงไหม)
 * - ห้ามมีข้อความไหนบอกว่าปกติหรือปลอดภัย
 * - ทางไปหาหมอต้องอยู่ทุกสถานะ
 */
test.describe.configure({ mode: "serial" });

/** คำที่ห้ามโผล่เด็ดขาด — เป็นการประเมินสุขภาพซึ่งแอปทำไม่ได้ */
const BANNED = ["ปกติดี", "ปลอดภัย", "สบายใจได้", "ไม่ต้องกังวล", "ทุกอย่างเรียบร้อย"];

async function expectNoReassurance(page: import("@playwright/test").Page) {
  const text = await page.locator("main").innerText();
  for (const word of BANNED) {
    expect(text, `หน้านี้ห้ามมีคำว่า "${word}"`).not.toContain(word);
  }
}

test("นับครบรอบ และรอบอยู่รอดตอนปิดหน้า", async ({ page }) => {
  await signUp(page, uniqueEmail("kick"), "แม่นับดิ้น");
  await completeOnboarding(page, "ครอบครัวนับดิ้น");

  await test.step("อายุครรภ์ 24 สัปดาห์ ยังนับไม่ได้ แต่ยังบอกทางไปหาหมอ", async () => {
    // goto ธรรมดา หน้านี้ยังไม่มีปุ่มอะไรให้กด จึงไม่มี client component ให้รอ hydrate
    await page.goto("/kicks");
    await expect(page.getByText("ยังไม่ถึงช่วงที่นับได้")).toBeVisible();
    await expect(page.getByText(/ให้ติดต่อโรงพยาบาลทันที/)).toBeVisible();
    await expect(page.getByRole("button", { name: "เริ่มนับ" })).toHaveCount(0);
    await expectNoReassurance(page);
  });

  await test.step("เลื่อน LMP ให้ถึงสัปดาห์ 30 แล้วเริ่มนับได้", async () => {
    await gotoApp(page, "/profile/pregnancy");
    const lmp = new Date();
    lmp.setDate(lmp.getDate() - 30 * 7);
    await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(lmp.toISOString().slice(0, 10));
    await page.getByRole("button", { name: /บันทึก/ }).click();
    await gotoApp(page, "/kicks");
    await expect(page.getByRole("button", { name: "เริ่มนับ" })).toBeVisible();
  });

  await test.step("แตะ 3 ครั้งแล้วออกจากหน้า กลับมาต้องยังอยู่ครบ", async () => {
    await page.getByRole("button", { name: "เริ่มนับ" }).click();
    const tap = page.getByRole("button", { name: /บันทึกการดิ้น/ });
    await expect(tap).toBeVisible({ timeout: 30_000 });

    for (let i = 0; i < 3; i++) {
      await tap.click();
      await page.waitForTimeout(150);
    }
    await expect(page.getByText("7 ครั้ง", { exact: true })).toBeVisible();

    // เวลาที่ผ่านไปต้องนับจากนาฬิกาของผู้ใช้ ไม่ใช่ของ worker ที่รันในโซน UTC
    // ถ้าสร้างเวลาฝั่งเซิร์ฟเวอร์ ตัวจับเวลาจะกระโดดไปเท่ากับผลต่างโซนเวลาทันที
    const elapsed = await page.getByText(/^\d+:\d{2}$/).first().innerText();
    const [mm] = elapsed.split(":").map(Number);
    expect(mm, `เพิ่งเริ่มนับแต่ขึ้นว่าผ่านไป ${elapsed}`).toBeLessThan(5);

    // ออกไปหน้าอื่นแล้วกลับมา = จำลองการปิดแอประหว่างนับ
    // dashboard ไม่มี client component ให้รอ hydrate
    await page.goto("/dashboard");
    await expect(page.getByText("กำลังนับอยู่")).toBeVisible();
    await gotoApp(page, "/kicks");
    await expect(page.getByText("7 ครั้ง", { exact: true })).toBeVisible();
  });

  await test.step("ลบครั้งล่าสุดได้", async () => {
    await page.getByRole("button", { name: "ลบครั้งล่าสุด" }).click();
    await expect(page.getByText("8 ครั้ง", { exact: true })).toBeVisible();
  });

  await test.step("นับจนครบ 10 แล้วบันทึก", async () => {
    const tap = page.getByRole("button", { name: /บันทึกการดิ้น/ });
    for (let i = 0; i < 8; i++) {
      await tap.click();
      await page.waitForTimeout(150);
    }
    await expect(page.getByText("ครบ 10 ครั้งแล้ว")).toBeVisible();
    await expectNoReassurance(page);

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByRole("button", { name: "เริ่มนับ" })).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("รอบที่ผ่านมา")).toBeVisible();
  });

  await test.step("ประวัติขึ้นแล้ว และยังไม่มีคำที่ให้ความมั่นใจ", async () => {
    await expect(page.getByText("10 ครั้ง").first()).toBeVisible();
    await expectNoReassurance(page);
  });
});

test("เริ่มซ้ำต้องได้รอบเดิม ไม่ใช่รอบใหม่", async ({ page, browser }) => {
  const email = uniqueEmail("kickdup");
  await signUp(page, email, "แม่รอบเดียว");
  await completeOnboarding(page, "ครอบครัวรอบเดียว");

  await gotoApp(page, "/profile/pregnancy");
  const lmp = new Date();
  lmp.setDate(lmp.getDate() - 30 * 7);
  await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(lmp.toISOString().slice(0, 10));
  await page.getByRole("button", { name: /บันทึก/ }).click();

  await gotoApp(page, "/kicks");
  await page.getByRole("button", { name: "เริ่มนับ" }).click();
  const tap = page.getByRole("button", { name: /บันทึกการดิ้น/ });
  await expect(tap).toBeVisible({ timeout: 30_000 });
  await tap.click();
  await expect(page.getByText("9 ครั้ง", { exact: true })).toBeVisible();

  // อีกคนในบ้านเปิดแอปพร้อมกัน ต้องเห็นรอบเดียวกัน ไม่ใช่เริ่มรอบใหม่แข่งกัน
  const ctx2 = await browser.newContext();
  const other = await ctx2.newPage();
  await other.goto("/login");
  await other.getByLabel("อีเมล").fill(email);
  await other.getByLabel("รหัสผ่าน", { exact: true }).fill("e2e-Passw0rd!");
  await other.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
  await other.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await other.goto("/kicks");
  await expect(other.getByText("9 ครั้ง", { exact: true })).toBeVisible();
  await ctx2.close();
});
