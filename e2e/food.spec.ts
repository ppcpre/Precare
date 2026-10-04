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
    // เมนูล่าง (มือถือ) กับ sidebar (จอกว้าง) เรนเดอร์พร้อมกันทั้งคู่ แล้วซ่อน
    // อีกอันด้วย CSS — และคนละ element คนละ role (nav กับ aside) จึงยึดที่
    // aria-label ตัวที่มองเห็นอยู่ เทสต์เดียวใช้ได้ทั้งสองขนาดจอ
    const nav = page.locator('[aria-label="เมนูหลัก"]:visible');
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

  /**
   * แก้ตัวเลขทีหลังต้องได้ — เลขที่ AI ประมาณให้ผิดได้ และคนมักรู้หลังกดบันทึกแล้ว
   * ถ้าแก้ไม่ได้ ทางเดียวคือลบแล้วพิมพ์ใหม่ ซึ่งคนจะปล่อยเลขผิดไว้แล้วยอดรวมผิดตลอด
   */
  await test.step("แก้ตัวเลขของรายการที่บันทึกแล้ว ยอดรวมต้องเปลี่ยนตาม", async () => {
    await page.getByRole("button", { name: "แก้ตัวเลขของ ชาเย็น" }).click();
    await page.getByLabel("พลังงาน ของ ชาเย็น").fill("120");
    await page.getByRole("button", { name: "บันทึกตัวเลขใหม่" }).click();
    // 590 + 120 = 710 (เดิม 770)
    await expect(page.getByTestId("food-totals")).toContainText("710", { timeout: 30_000 });
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

  await test.step("หน้าแรกมีการ์ดสรุปอาหารวันนี้ และกดเข้าหน้านับแคลได้", async () => {
    await gotoApp(page, "/dashboard");
    const card = page.getByText("อาหารวันนี้").locator("..").locator("..");
    await expect(card).toContainText("590");
    await card.getByRole("link", { name: /บันทึกเพิ่ม/ }).click();
    await expect(page).toHaveURL(/\/food$/);
  });

  /**
   * กราฟย้อนหลัง — จุดที่พลาดง่ายคือขอบท้ายของช่วง ถ้า query ใช้ `<` กับวันนี้
   * บันทึกของวันนี้จะหายไปจากกราฟทั้งหมดโดยไม่มีอะไรฟ้อง
   */
  await test.step("กราฟย้อนหลังนับบันทึกของวันนี้ด้วย และสลับมุมมองได้", async () => {
    await page.getByRole("link", { name: "ย้อนหลัง" }).click();
    await expect(page).toHaveURL(/\/food\/history$/);

    for (const range of ["รายวัน", "รายสัปดาห์", "รายเดือน"]) {
      await page.getByRole("button", { name: range }).click();
      await expect(page.getByText(/เฉลี่ย/)).toContainText("590");
      await expect(page.getByText("ยังไม่มีบันทึกในช่วงนี้")).toHaveCount(0);
    }

    await test.step("เปลี่ยนสารอาหารแล้วกราฟเปลี่ยนตาม", async () => {
      await page.getByRole("button", { name: "โปรตีน" }).click();
      await expect(page.getByText(/เฉลี่ย/)).toContainText("28");
    });
  });
});
