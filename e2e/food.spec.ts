import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — บันทึกอาหารและนับรวมทั้งวัน
 *
 * ยอดรวมคือสิ่งเดียวที่คนดูจริงบนหน้านี้ ถ้าบวกผิดหรือไม่อัปเดตหลังเพิ่ม/ลบ
 * ฟีเจอร์ทั้งหมดก็ไม่มีความหมาย — เทสต์จึงเช็คยอดรวม ไม่ใช่แค่ว่ารายการขึ้น
 *
 * AI ไม่ถูกเรียกในเทสต์นี้ (wrangler dev --local ปิด binding ที่เป็น remote)
 * ซึ่งตรงกับเส้นทางจริงตอนโควตาหมด — ต้องกรอกเองแล้วบันทึกได้ตามปกติ
 */
test.describe.configure({ mode: "serial" });

async function addFood(page: import("@playwright/test").Page, name: string, nums: number[]) {
  await page.getByLabel("ชื่อเมนู").fill(name);
  const labels = ["พลังงาน", "คาร์บ", "น้ำตาล", "โปรตีน"];
  for (const [i, label] of labels.entries()) {
    await page.getByLabel(label, { exact: true }).fill(String(nums[i]));
  }
  await page.getByRole("button", { name: "บันทึกเมนู" }).click();
}

test("เพิ่มเมนูแล้วยอดรวมทั้งวันขยับ และลบแล้วลดลงตาม", async ({ page }) => {
  await signUp(page, uniqueEmail("food"), "แม่นับแคล");
  await completeOnboarding(page, "ครอบครัวนับแคล");

  await test.step("เมนู นับแคล อยู่ในแถบล่าง แทนที่โปรไฟล์", async () => {
    // เมนูล่างกับเมนูเดสก์ท็อปเรนเดอร์พร้อมกันทั้งคู่ (ซ่อนอีกอันด้วย CSS)
    // จึงต้องเจาะไปที่แถบเมนูหลักตัวที่เห็นอยู่ ไม่ใช่ค้นทั้งหน้า
    const nav = page.getByRole("navigation", { name: "เมนูหลัก" }).first();
    await expect(nav.getByRole("link", { name: "นับแคล" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "โปรไฟล์", exact: true })).toHaveCount(0);
    // โปรไฟล์ต้องยังเข้าได้จากรูปมุมขวาบน ไม่งั้นตั้งค่าอะไรไม่ได้เลย
    await expect(page.getByRole("link", { name: /^โปรไฟล์ของ/ })).toBeVisible();
  });

  await gotoApp(page, "/food");

  await test.step("ยังไม่มีอะไร ยอดรวมเป็นศูนย์", async () => {
    await expect(page.getByText("ยังไม่ได้บันทึกอะไรวันนี้")).toBeVisible();
  });

  await test.step("เพิ่มสองเมนู ยอดรวมต้องเป็นผลบวกของทั้งคู่", async () => {
    await addFood(page, "ข้าวมันไก่", [590, 72, 6, 28]);
    // ชื่อเมนูโผล่สองที่: ในรายการของวัน และในชิป "เคยกิน" ที่เพิ่งมี
    await expect(page.getByText("ข้าวมันไก่").first()).toBeVisible({ timeout: 30_000 });

    await addFood(page, "ชาเย็น", [180, 34, 31, 3]);
    await expect(page.getByText("ชาเย็น").first()).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("food-totals")).toContainText("770");
  });

  await test.step("ลบรายการหนึ่ง ยอดรวมต้องลดลงตาม", async () => {
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "ลบ ชาเย็น" }).click();
    await expect(page.getByText("ชาเย็น")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("food-totals")).toContainText("590");
  });

  await test.step("เมนูที่เคยกินกดซ้ำได้ และได้ตัวเลขเดิมโดยไม่ต้องเรียก AI", async () => {
    const chip = page.getByRole("button", { name: "ข้าวมันไก่", exact: true });
    await expect(chip).toBeVisible();
    await chip.click();

    await expect(page.getByLabel("ชื่อเมนู")).toHaveValue("ข้าวมันไก่");
    await expect(page.getByLabel("พลังงาน", { exact: true })).toHaveValue("590");
    await expect(page.getByLabel("โปรตีน", { exact: true })).toHaveValue("28");
    await expect(page.getByText("ใช้ค่าที่เคยบันทึกไว้")).toBeVisible();
  });
});
