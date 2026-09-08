import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * จับเวลาการบีบตัวของมดลูก
 *
 * ข้อห้ามเข้มกว่านับลูกดิ้น เพราะหน้านี้ถูกใช้ตอนตัดสินใจว่าจะไปโรงพยาบาลไหม
 * ห้ามมีข้อความไหนที่แปลว่า "ยังไม่ต้องไป" หรือ "รอได้" ไม่ว่าตัวเลขจะเป็นยังไง
 */
const BANNED = [
  "ยังไม่ต้องไป",
  "รอได้",
  "ปกติดี",
  "ปลอดภัย",
  "ไม่ต้องกังวล",
  "ถึงเวลาแล้ว",
  "คลอดแล้ว",
];

async function expectNoReassurance(page: import("@playwright/test").Page) {
  const text = await page.locator("main").innerText();
  for (const word of BANNED) {
    expect(text, `หน้านี้ห้ามมีคำว่า "${word}"`).not.toContain(word);
  }
}

async function setWeek(page: import("@playwright/test").Page, weeks: number) {
  await gotoApp(page, "/profile/pregnancy");
  const lmp = new Date();
  lmp.setDate(lmp.getDate() - weeks * 7);
  await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(lmp.toISOString().slice(0, 10));
  await page.getByRole("button", { name: /บันทึก/ }).click();
  await page.waitForURL(/\/profile/, { timeout: 30_000 });
}

test("จับเวลาการบีบตัว: ปุ่มเดียวสองหน้าที่ และไม่บอกให้รอ", async ({ page }) => {
  await signUp(page, uniqueEmail("labor"), "แม่ใกล้คลอด");
  await completeOnboarding(page, "ครอบครัวใกล้คลอด");

  await test.step("ก่อนสัปดาห์ 36 จับไม่ได้ แต่ต้องพาไปหาหมอ ไม่ใช่แค่บอกว่ายังไม่ถึงเวลา", async () => {
    await setWeek(page, 30);
    // goto ธรรมดา หน้านี้ยังไม่มีปุ่มให้กด จึงไม่มี client component ให้รอ hydrate
    await page.goto("/labor");
    await expect(page.getByText("ยังไม่ถึงช่วงที่จับเวลาได้")).toBeVisible();
    await expect(page.getByText(/ให้ติดต่อโรงพยาบาลเลย/)).toBeVisible();
    await expect(page.getByRole("button", { name: "เริ่มจับเวลา" })).toHaveCount(0);
    await expectNoReassurance(page);
  });

  await test.step("อาการที่ต้องไปทันทีต้องอยู่ในหน้า ไม่ใช่ซ่อนอยู่ที่อื่น", async () => {
    await expect(page.getByText("น้ำเดิน หรือมีน้ำไหลออกมา")).toBeVisible();
    await expect(page.getByText("ลูกดิ้นน้อยลงหรือหยุดดิ้น")).toBeVisible();
  });

  await test.step("สัปดาห์ 37 เริ่มจับเวลาได้", async () => {
    await setWeek(page, 37);
    await gotoApp(page, "/labor");
    await page.getByRole("button", { name: "เริ่มจับเวลา" }).click();
    await expect(page.getByRole("button", { name: "แตะเมื่อเริ่มบีบ" })).toBeVisible();
  });

  await test.step("ปุ่มเดียวสลับระหว่างเริ่มบีบกับคลาย", async () => {
    await page.getByRole("button", { name: "แตะเมื่อเริ่มบีบ" }).click();
    await expect(page.getByRole("button", { name: "แตะเมื่อคลายแล้ว" })).toBeVisible();

    await page.getByRole("button", { name: "แตะเมื่อคลายแล้ว" }).click();
    await expect(page.getByRole("button", { name: "แตะเมื่อเริ่มบีบ" })).toBeVisible();
    await expect(page.getByText("1 ครั้ง")).toBeVisible();
  });

  await test.step("ยังไม่ครบเกณฑ์ ต้องโชว์ว่าครบกี่ข้อ ไม่ใช่บอกว่ารอได้", async () => {
    await expect(page.getByText(/ครบ \d จาก 3/)).toBeVisible();
    await expectNoReassurance(page);
  });

  await test.step("รอบต้องอยู่รอดตอนปิดหน้าแล้วเปิดใหม่", async () => {
    await gotoApp(page, "/labor");
    await expect(page.getByRole("button", { name: "แตะเมื่อเริ่มบีบ" })).toBeVisible();
    await expect(page.getByText("1 ครั้ง")).toBeVisible();
  });

  await test.step("หยุดจับเวลาแล้วรอบเข้าไปอยู่ในประวัติ", async () => {
    await page.getByRole("button", { name: /หยุดจับเวลาและบันทึก/ }).click();
    await expect(page.getByRole("button", { name: "เริ่มจับเวลา" })).toBeVisible();
    await expect(page.getByText("รอบที่ผ่านมา")).toBeVisible();
  });

  await test.step("ทางเข้าโผล่บนหน้าแรกเมื่อถึงสัปดาห์แล้ว", async () => {
    // หน้าแรกไม่มีปุ่มให้กดเลยในสถานะนี้ (ทางเข้าทุกอันเป็นลิงก์)
    // จึงไม่มี client component ให้รอ hydrate ใช้ goto ธรรมดา
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /จับเวลาการบีบตัว/ })).toBeVisible();
  });
});
