import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  gotoApp,
  makePng,
  pickFiles,
  signUp,
  uniqueEmail,
} from "./helpers";

/** วันที่ตายตัว เทียบกับวันเกิดที่ตั้งไว้ ไม่อิงวันที่รันเทสต์ */
const BORN = "2024-06-10";

/**
 * Regression — สมุดรูปของลูก
 *
 * สองอย่างที่ unit test จับไม่ได้และพังแบบเงียบๆ ได้ทั้งคู่:
 *
 * 1) รูปลูกรั่วเข้าอัลบั้มครรภ์ — รูปลูกไม่มีค่า week ถ้า listPhotos ไม่กรอง
 *    childId รูปทั้งหมดจะไปกองใต้ "ไม่ระบุสัปดาห์" ปนกับอัลตราซาวด์
 *
 * 2) แก้วันเกิดแล้วรูปไม่ขยับช่อง — เป็นเหตุผลทั้งหมดที่ช่องอายุต้องคำนวณสด
 *    ถ้าวันหนึ่งมีคนเก็บช่องลง DB เพื่อ "ให้เร็วขึ้น" เทสต์นี้ต้องแดง
 */
test("สมุดรูปของลูก: ช่องว่างชวนเติม รูปเข้าช่องถูก และไม่ปนกับอัลบั้มครรภ์", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("baby"), "แม่สมุดรูป");
  await completeOnboarding(page, "ครอบครัวสมุดรูป");

  await test.step("ยังไม่มีลูก = ชวนให้เพิ่ม ไม่สร้างให้เอง", async () => {
    await gotoApp(page, "/baby");
    await expect(page.getByText("ยังไม่ได้เพิ่มลูก")).toBeVisible();
  });

  await test.step("เพิ่มลูกแล้วได้ช่องว่างครบ 26 ช่อง", async () => {
    await page.getByLabel("ชื่อที่เรียก").fill("น้องมะลิ");
    await page.getByLabel("วันเกิด").fill(BORN);
    await page.getByRole("button", { name: "เพิ่มลูก" }).click();
    await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });

    await expect(page.getByRole("heading", { name: "น้องมะลิ" })).toBeVisible();
    await expect(page.getByText("0/26")).toBeVisible();
    // ช่องว่างต้องแสดง ไม่ใช่ซ่อน — เป็นตัวฟีเจอร์ ไม่ใช่ผลข้างเคียง
    await expect(page.getByRole("link", { name: /สัปดาห์ที่ 1 · ยังไม่มีรูป/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /2 ขวบ 9 เดือน · ยังไม่มีรูป/ })).toBeVisible();
  });

  const babyUrl = page.url();

  await test.step("กดช่องว่างแล้วได้วันที่ตั้งต้นของช่องนั้นมาให้เลย", async () => {
    await page.getByRole("link", { name: /^6 เดือน · ยังไม่มีรูป/ }).click();
    await page.waitForURL(/\/album\/upload\?childId=/, { timeout: 30_000 });
    // ครบ 6 เดือนของเด็กที่เกิด 10 มิ.ย. 67 คือ 10 ธ.ค. 67
    await expect(page.locator('input[type="date"]').first()).toHaveValue("2024-12-10");
  });

  await test.step("อัปรูปแล้วเข้าช่อง 6 เดือน ไม่ใช่ช่องอื่น", async () => {
    await pickFiles(page, [
      { name: "baby.png", mimeType: "image/png", buffer: makePng(900, 700, 3) },
    ]);
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(1, { timeout: 30_000 });
    await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
    await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 45_000 });

    await expect(page.getByText("1/26")).toBeVisible();
    await expect(page.getByRole("link", { name: /^6 เดือน · 1 รูป/ })).toBeVisible();
    await expect(page.getByRole("link", { name: /^5 เดือน · ยังไม่มีรูป/ })).toBeVisible();
  });

  await test.step("รูปลูกต้องไม่โผล่ในอัลบั้มของครรภ์", async () => {
    await gotoApp(page, "/album");
    await expect(page.getByText("ยังไม่มีรูปในอัลบั้ม")).toBeVisible();
    // แต่ต้องมีทางข้ามไปสมุดของลูกจากตรงนี้
    await expect(page.getByRole("link", { name: "น้องมะลิ" })).toBeVisible();
  });

  await test.step("แก้วันเกิดแล้วรูปขยับช่องเองทันที — ไม่มีอะไรต้อง migrate", async () => {
    await page.goto(babyUrl);
    await page.getByRole("button", { name: "แก้ชื่อหรือวันเกิด" }).click();
    // เลื่อนวันเกิดไปข้างหน้า 1 เดือน รูปใบเดิมจึงกลายเป็นตอนอายุ 5 เดือน
    await page.getByLabel("วันเกิด").fill("2024-07-10");
    await page.getByRole("button", { name: "บันทึกการแก้ไข" }).click();

    await expect(page.getByRole("link", { name: /^5 เดือน · 1 รูป/ })).toBeVisible({
      timeout: 30_000,
    });
    await expect(page.getByRole("link", { name: /^6 เดือน · ยังไม่มีรูป/ })).toBeVisible();
  });

  await test.step("น้ำหนักและหมุดพัฒนาการเป็นของเสริม พับไว้ กรอกได้ถ้าอยากกรอก", async () => {
    await page.getByRole("button", { name: "น้ำหนักและส่วนสูง" }).click();
    await page.getByLabel("น้ำหนัก").fill("7.4");
    await page.getByLabel("ส่วนสูง").fill("66");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("7.4 กก. · 66 ซม.")).toBeVisible({ timeout: 30_000 });

    await page.getByRole("button", { name: "หมุดพัฒนาการ" }).click();
    const sit = page.getByRole("button", { name: /นั่งได้เอง/ });
    await expect(sit).toHaveAttribute("aria-pressed", "false");
    await sit.click();
    await expect(sit).toHaveAttribute("aria-pressed", "true", { timeout: 30_000 });
  });
});

/**
 * ลูกของครอบครัวอื่นต้องเปิดไม่ได้
 *
 * D1 ไม่มี row-level security — ถ้า getChild กรองแค่ id คนที่เห็น URL
 * จะอ่านสมุดรูปลูกของคนอื่นได้ทั้งเล่ม
 */
test("เปิดสมุดรูปลูกของครอบครัวอื่นด้วย URL ตรงๆ ไม่ได้", async ({ page }) => {
  await signUp(page, uniqueEmail("owner"), "เจ้าของ");
  await completeOnboarding(page, "ครอบครัวเจ้าของ");
  await gotoApp(page, "/baby");
  await page.getByLabel("ชื่อที่เรียก").fill("น้องลับ");
  await page.getByLabel("วันเกิด").fill(BORN);
  await page.getByRole("button", { name: "เพิ่มลูก" }).click();
  await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });
  const secret = page.url();

  await page.context().clearCookies();
  await signUp(page, uniqueEmail("stranger"), "คนนอก");
  await completeOnboarding(page, "ครอบครัวคนนอก");

  await page.goto(secret);
  /**
   * เช็คเนื้อหา ไม่เช็ค status
   *
   * หน้า not-found ของแอปนี้ตอบ 200 มาแต่เดิม (เรนเดอร์อยู่ใน layout เดียวกัน)
   * ซึ่งเป็นคนละเรื่องกับความปลอดภัย สิ่งที่ต้องไม่เกิดคือชื่อลูกโผล่ออกมา
   */
  await expect(page.getByText("ไม่พบหน้านี้")).toBeVisible();
  await expect(page.getByText("น้องลับ")).toHaveCount(0);
});
