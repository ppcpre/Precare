import { expect, test } from "@playwright/test";
import type { Page } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, signUp, uniqueEmail } from "./helpers";

/** แถบ "บันทึกแล้ว · …" — หน้าแรกมี role=status ตัวอื่นอยู่ด้วย จึงกรองด้วยข้อความ */
const toast = (page: Page) => page.getByRole("status").filter({ hasText: "บันทึกแล้ว" });

/**
 * บันทึกประจำวันลูก (หลังคลอด รอบ 1)
 *
 * ของที่ unit test จับไม่ได้:
 * - การ์ดลูกบนหน้าแรกขึ้นเฉพาะเมื่อมีคนเพิ่มลูก และไม่แสดงความยินดี
 * - แตะผ้าอ้อมแล้วบันทึกทันที และ "เลิกทำ" ลบจริง
 * - รอบจับเวลาอยู่ใน D1 — ออกจากหน้าแล้วกลับมาต้องยังนับอยู่
 * - เต้าบอกข้างถัดไปจากข้างที่จบครั้งก่อน
 */
test("บันทึกประจำวันลูก: ผ้าอ้อม ขวด นอน เต้า", async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page, uniqueEmail("babylog"), "แม่บันทึก");
  await completeOnboarding(page, "ครอบครัวบันทึกลูก");

  await test.step("ยังไม่เพิ่มลูก = ไม่มีการ์ดลูก", async () => {
    await expect(page.getByRole("link", { name: "ดูทั้งวัน" })).toHaveCount(0);
  });

  await test.step("เพิ่มลูกแล้วหน้าแรกมีการ์ดลูก ข้อความเป็นกลาง", async () => {
    await gotoApp(page, "/baby");
    await page.getByLabel("ชื่อที่เรียก").fill("น้องข้าว");
    await page.getByLabel("วันเกิด").fill(daysAgo(20));
    await page.getByRole("button", { name: "เพิ่มลูก" }).click();
    await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });

    await gotoApp(page, "/dashboard");
    await expect(page.getByRole("link", { name: "ดูทั้งวัน" })).toBeVisible();
    await expect(page.getByText("น้องข้าว")).toBeVisible();
    // ตรวจเฉพาะการ์ดลูก — การ์ดพัฒนาการรายสัปดาห์ของครรภ์ (คนละเรื่อง) ยังอยู่เพราะยังตั้งครรภ์ในเทสต์นี้
    const body = await page.getByRole("region", { name: "บันทึกของน้องข้าว" }).innerText();
    for (const word of ["ยินดี", "ลูกน้อย"]) expect(body).not.toContain(word);
  });

  await test.step("แตะผ้าอ้อมแล้วบันทึกเลย · เลิกทำแล้วหายจริง", async () => {
    await page.getByRole("button", { name: /^ผ้าอ้อม/ }).click();
    await page.getByRole("dialog", { name: "ผ้าอ้อม" }).getByRole("button", { name: /^อึ/ }).click();
    await expect(toast(page)).toContainText("ผ้าอ้อม · อึ", { timeout: 15_000 });
    await page.getByRole("button", { name: "เลิกทำ" }).click();
    await expect(toast(page)).toHaveCount(0, { timeout: 15_000 });

    await page.getByRole("button", { name: /^ผ้าอ้อม/ }).click();
    await page.getByRole("dialog", { name: "ผ้าอ้อม" }).getByRole("button", { name: /^ฉี่/ }).click();
    await expect(toast(page)).toContainText("ผ้าอ้อม · ฉี่", { timeout: 15_000 });
  });

  await test.step("ขวดนม 120 มล.", async () => {
    await page.getByRole("button", { name: /^ขวดนม/ }).click();
    const sheet = page.getByRole("dialog", { name: "ขวดนม" });
    await sheet.getByRole("radio", { name: "นมผง" }).click();
    await sheet.getByRole("button", { name: "120", exact: true }).click();
    await sheet.getByRole("button", { name: "บันทึก" }).click();
    await expect(toast(page)).toContainText("ขวดนม 120 มล.", { timeout: 15_000 });
  });

  await test.step("หน้าวันนี้: มีแค่ฉี่ (อึถูกเลิกทำ) และบอกว่าใครบันทึก", async () => {
    // บันทึกเมื่อกี้สั่ง router.refresh() — กดลิงก์ระหว่าง refresh ยังไม่จบ การนำทางโดนยกเลิก
    // (เห็นเฉพาะตอนเครื่องช้า) จึงกดซ้ำจนกว่า URL จะเปลี่ยนจริง
    await expect(async () => {
      await page.getByRole("link", { name: "ดูทั้งวัน" }).click();
      await page.waitForURL(/\/baby\/[0-9a-f-]+\/log$/, { timeout: 8_000 });
    }).toPass({ timeout: 45_000 });
    await expect(page.getByText("ผ้าอ้อม · ฉี่")).toBeVisible();
    await expect(page.getByText("ผ้าอ้อม · อึ")).toHaveCount(0);
    await expect(page.getByText("ขวดนม · 120 มล. · นมผง")).toBeVisible();
    await expect(page.getByText(/บันทึกโดย คุณ/).first()).toBeVisible();
  });

  await test.step("นอน: เริ่มแล้วออกจากหน้า กลับมายังนับอยู่ แล้วหยุด", async () => {
    await page.getByRole("link", { name: /^นอน/ }).click();
    await page.waitForURL(/\/log\/sleep$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "เริ่มนอน" }).click();
    await expect(page.getByRole("button", { name: "ตื่นแล้ว · หยุด" })).toBeVisible({ timeout: 15_000 });

    await gotoApp(page, "/dashboard");
    await expect(page.getByRole("link", { name: /กำลังนอน/ })).toBeVisible();
    await page.getByRole("link", { name: /กำลังนอน/ }).click();
    await page.getByRole("button", { name: "ตื่นแล้ว · หยุด" }).click();
    await page.waitForURL(/\/log$/, { timeout: 30_000 });
    await expect(page.getByText(/^นอน · /).first()).toBeVisible();
  });

  await test.step("เต้า: ซ้ายแล้วสลับขวา ครั้งถัดไปแนะนำซ้าย", async () => {
    await page.getByRole("link", { name: /^เต้า/ }).click();
    await page.waitForURL(/\/log\/breast$/, { timeout: 30_000 });
    await page.getByRole("button", { name: /^ซ้าย/ }).click();
    // รอ id ของรอบจากเซิร์ฟเวอร์ก่อนแตะต่อ (ปุ่มทิ้งรอบขึ้นเมื่อได้ id แล้ว)
    await expect(page.getByRole("button", { name: "ทิ้งรอบนี้" })).toBeVisible({ timeout: 15_000 });
    await page.getByRole("button", { name: /^ขวา/ }).click();
    await expect(page.getByRole("button", { name: /^ขวา/ })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "หยุดและบันทึก" }).click();
    await page.waitForURL(/\/log$/, { timeout: 30_000 });

    await gotoApp(page, "/dashboard");
    await expect(page.getByText("ต่อไป: ซ้าย")).toBeVisible();
  });
});
