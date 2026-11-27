import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — พิมพ์อาการเองได้ และครั้งถัดไปต้องกดเลือกซ้ำได้
 *
 * ครึ่งหลังคือใจความจริงของฟีเจอร์นี้ ถ้าพิมพ์ได้แต่ครั้งหน้าต้องพิมพ์ใหม่
 * ทุกสัปดาห์ ก็ไม่ต่างจากเขียนลงช่องบันทึกท้ายฟอร์ม
 */
test.describe.configure({ mode: "serial" });

const CUSTOM = "ปวดท้องน้อยด้านขวา";

test("พิมพ์อาการเองได้ บันทึกติด และครั้งถัดไปขึ้นเป็นชิปให้กดเลือก", async ({ page }) => {
  await signUp(page, uniqueEmail("sym"), "แม่อาการ");
  await completeOnboarding(page, "ครอบครัวอาการ");

  await test.step("พิมพ์อาการเองแล้วบันทึก", async () => {
    await gotoApp(page, "/health/new");
    await page.getByLabel("เพิ่มอาการเอง").fill(CUSTOM);
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();

    // ต้องกลายเป็นชิปที่ถูกเลือกไว้ทันที ไม่ใช่รอจนบันทึก
    await expect(page.getByRole("button", { name: CUSTOM, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    // ช่องต้องถูกล้าง พร้อมพิมพ์อาการถัดไป
    await expect(page.getByLabel("เพิ่มอาการเอง")).toHaveValue("");

    await page.getByRole("button", { name: /บันทึก/ }).first().click();
    await page.waitForURL(/\/health(\?|$)/, { timeout: 30_000 });
  });

  await test.step("อาการที่พิมพ์เองต้องขึ้นในรายการบันทึก", async () => {
    await expect(page.getByText(CUSTOM).first()).toBeVisible();
  });

  await test.step("ครั้งถัดไปขึ้นเป็นชิปให้กดเลือก ไม่ต้องพิมพ์ใหม่", async () => {
    await gotoApp(page, "/health/new");
    const chip = page.getByRole("button", { name: CUSTOM, exact: true });
    await expect(chip).toBeVisible();
    // ยังไม่ถูกเลือก — เป็นตัวเลือก ไม่ใช่ค่าเริ่มต้น
    await expect(chip).toHaveAttribute("aria-pressed", "false");
    await chip.click();
    await expect(chip).toHaveAttribute("aria-pressed", "true");
  });
});

test("กดเพิ่มอาการที่มีอยู่แล้ว = เลือกอันนั้น ไม่สร้างซ้ำ", async ({ page }) => {
  await signUp(page, uniqueEmail("symdup"), "แม่ไม่ซ้ำ");
  await completeOnboarding(page, "ครอบครัวไม่ซ้ำ");

  await gotoApp(page, "/health/new");
  await page.getByLabel("เพิ่มอาการเอง").fill("คลื่นไส้");
  await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();

  // "คลื่นไส้" อยู่ในชุดสำเร็จอยู่แล้ว ต้องมีชิปเดียว ไม่ใช่สองชิปซ้อนกัน
  await expect(page.getByRole("button", { name: "คลื่นไส้", exact: true })).toHaveCount(1);
  await expect(page.getByRole("button", { name: "คลื่นไส้", exact: true })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});
