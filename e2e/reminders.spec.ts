import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — เลือกเวลาเตือนได้หลายครั้ง สูงสุด 3
 *
 * ของเดิมเป็นเลือกได้ครั้งเดียว (คอลัมน์เดียวในตารางนัด) การเปลี่ยนมาเป็น
 * ตารางลูกทำให้มีทางพังเงียบสองทาง: บันทึกแล้วเปิดกลับมาไม่เห็นที่เลือกไว้
 * กับเพดานสามที่บังคับแต่ใน UI แล้วลืมบังคับฝั่ง server
 */
test.describe.configure({ mode: "serial" });

/** วันพรุ่งนี้ในรูปแบบ YYYY-MM-DD — นัดต้องอยู่อนาคตถึงจะมีส่วนแจ้งเตือนให้ตั้ง */
const tomorrow = () => new Date(Date.now() + 86400_000).toISOString().slice(0, 10);

test("เลือกเวลาเตือนได้ 3 ครั้ง ครบแล้วกดเพิ่มไม่ได้ และจำค่าไว้", async ({ page }) => {
  await signUp(page, uniqueEmail("remind"), "แม่ตั้งเตือน");
  await completeOnboarding(page, "ครอบครัวตั้งเตือน");

  await gotoApp(page, "/appointments/new");
  await page.getByLabel("วันที่").fill(tomorrow());
  await page.getByLabel("เวลา").fill("14:00");
  await page.getByLabel("หัวข้อนัด").fill("ตรวจครรภ์");

  const chip = (label: string) => page.getByRole("button", { name: label, exact: true });

  await test.step("ค่าตั้งต้นคือ 1 ชม. หนึ่งครั้ง", async () => {
    await expect(page.getByText("เลือกได้ 1/3")).toBeVisible();
    await expect(chip("1 ชม.")).toHaveAttribute("aria-pressed", "true");
  });

  await test.step("เลือกเพิ่มจนครบ 3 แล้วตัวที่เหลือกดไม่ได้", async () => {
    await chip("1 วัน").click();
    await chip("30 นาที").click();
    await expect(page.getByText("เลือกได้ 3/3")).toBeVisible();

    // ชิปที่ยังไม่ได้เลือกต้องถูกปิด ไม่ใช่กดแล้วเงียบ
    await expect(chip("3 ชม.")).toBeDisabled();
    // ส่วนชิปที่เลือกอยู่ต้องยังกดเอาออกได้เสมอ ไม่งั้นติดล็อกแก้อะไรไม่ได้เลย
    await expect(chip("1 วัน")).toBeEnabled();
  });

  await test.step("บันทึกแล้วการ์ดต้องขึ้นครบทั้งสามเวลา", async () => {
    await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
    await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });

    const card = page.getByText(/เตือนก่อน/).first();
    await expect(card).toContainText("1 วัน");
    await expect(card).toContainText("1 ชั่วโมง");
    await expect(card).toContainText("30 นาที");
  });

  await test.step("เปิดกลับมาแก้ ต้องเห็นสามชิปที่เลือกไว้", async () => {
    await page.getByRole("link", { name: "แก้ไขนัดหมาย" }).first().click();
    await page.waitForURL(/\/appointments\/[0-9a-f-]+\/edit/, { timeout: 30_000 });

    await expect(page.getByText("เลือกได้ 3/3")).toBeVisible();
    for (const label of ["1 วัน", "1 ชม.", "30 นาที"]) {
      await expect(chip(label)).toHaveAttribute("aria-pressed", "true");
    }
  });

  await test.step("เอาออกเหลือครั้งเดียวได้ และชิปอื่นกลับมากดได้", async () => {
    await chip("1 วัน").click();
    await chip("30 นาที").click();
    await expect(page.getByText("เลือกได้ 1/3")).toBeVisible();
    await expect(chip("3 ชม.")).toBeEnabled();
  });
});
