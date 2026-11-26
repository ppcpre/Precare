import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, daysAhead, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * ลูกในนัด / ยา / ไข้ (หลังคลอด รอบ 3)
 *
 * ของที่ unit test จับไม่ได้:
 * - นัดของลูกบันทึกแล้วการ์ดบอกว่าของใคร และถูกใส่กลุ่ม "ลูก" ให้เอง
 * - ให้ยาซ้ำภายในช่วงห่าง เซิร์ฟเวอร์ถามก่อน (D3) — "ยังไม่ให้" ไม่บันทึก · "บันทึกต่อ" บันทึก
 * - การ์ดไข้ของลูกอายุต่ำกว่า 2 เดือนขึ้น และพาไปหน้าอาการได้
 */
test("ลูกในนัด ยาของลูก และบันทึกไข้", async ({ page }) => {
  test.setTimeout(150_000);
  await signUp(page, uniqueEmail("childcare"), "แม่ดูแลลูก");
  await completeOnboarding(page, "ครอบครัวดูแลลูก");

  await gotoApp(page, "/baby");
  await page.getByLabel("ชื่อที่เรียก").fill("น้องดูแล");
  await page.getByLabel("วันเกิด").fill(daysAgo(20));
  await page.getByRole("button", { name: "เพิ่มลูก" }).click();
  await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });
  const childId = new URL(page.url()).pathname.split("/")[2];

  await test.step("D1 นัดของลูก: เลือกจากหน้าลูก การ์ดบอกว่าของใคร", async () => {
    await gotoApp(page, `/baby/${childId}/log`);
    await page.getByRole("link", { name: "เพิ่มนัดของลูก" }).click();
    await page.waitForURL(/\/appointments\/new\?child=/, { timeout: 30_000 });
    await expect(page.getByRole("button", { name: "น้องดูแล" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("นัดของลูก ทุกคนในบ้านเห็นและได้รับเตือน")).toBeVisible();
    await page.getByLabel("วันที่", { exact: true }).fill(daysAhead(5));
    await page.getByLabel("เวลา", { exact: true }).fill("09:30");
    await page.getByRole("button", { name: "ตรวจสุขภาพเด็กดี" }).click();
    await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
    await page.waitForURL(/\/appointments$/, { timeout: 30_000 });
    await expect(page.getByText("ของน้องดูแล")).toBeVisible();
    await expect(page.getByText("ตรวจสุขภาพเด็กดี")).toBeVisible();
  });

  await test.step("D2 เพิ่มยาตามอาการ ห่าง 4 ชม. แล้วบันทึกว่าให้", async () => {
    await gotoApp(page, `/baby/${childId}/meds`);
    await expect(page.getByText("ยังไม่มียาของลูก")).toBeVisible();
    await page.getByRole("link", { name: "เพิ่มยาของลูก" }).first().click();
    await page.waitForURL(/\/meds\/new$/, { timeout: 30_000 });
    await page.getByLabel("ชื่อยา").fill("ยาลดไข้ (น้ำ)");
    await page.getByLabel("ครั้งละ").fill("1.2 มล.");
    await page.getByRole("radio", { name: "4 ชม." }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/meds$/, { timeout: 30_000 });

    await page.getByRole("button", { name: "บันทึกว่าให้ยาแล้ว" }).click();
    await expect(page.getByText(/ให้ล่าสุด \d\d:\d\d โดยคุณ/)).toBeVisible({ timeout: 15_000 });
  });

  await test.step("D3 กดซ้ำทันที = ถามก่อน · ยังไม่ให้ ไม่บันทึก · บันทึกต่อ บันทึก", async () => {
    await page.getByRole("button", { name: "บันทึกว่าให้ยาแล้ว" }).click();
    const dialog = page.getByRole("alertdialog", { name: "คุณเพิ่งให้ยานี้ไป" });
    await expect(dialog).toBeVisible({ timeout: 15_000 });
    await expect(dialog.getByText("ช่วงห่างที่ตั้งไว้")).toBeVisible();
    await dialog.getByRole("button", { name: "ยังไม่ให้" }).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByRole("button", { name: /^ลบรายการให้ยา/ })).toHaveCount(1);

    await page.getByRole("button", { name: "บันทึกว่าให้ยาแล้ว" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: /^บันทึกต่อ/ }).click();
    await expect(page.getByRole("button", { name: /^ลบรายการให้ยา/ })).toHaveCount(2, { timeout: 15_000 });
  });

  await test.step("D4 ไข้: ลูกอายุ 20 วันเห็นการ์ดจากหน้าอาการ บันทึกแล้วขึ้นในรายการ", async () => {
    await gotoApp(page, `/baby/${childId}/log`);
    await page.getByRole("link", { name: "บันทึกไข้" }).click();
    await page.waitForURL(/\/temp$/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "ลูกอายุต่ำกว่า 2 เดือน" })).toBeVisible();
    await expect(page.getByText(/ตัวร้อน หรือตัวเย็นผิดปกติ/)).toBeVisible();

    await page.getByRole("button", { name: "ดูดนมน้อยลง" }).click();
    await expect(page.getByText(/ไม่ดูดนม หรือดูดน้อยกว่าปกติมาก/)).toBeVisible();
    for (let i = 0; i < 12; i++) await page.getByRole("button", { name: "เพิ่ม 0.1 องศา" }).click();
    await expect(page.getByLabel("อุณหภูมิ")).toHaveText("38.2 °C");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/temp\?saved=1$/, { timeout: 30_000 });
    await expect(page.getByRole("listitem").filter({ hasText: "38.2 °C" })).toContainText("ดูดนมน้อยลง");

    await page.getByRole("link", { name: "ดูรายการอาการทั้งหมด" }).click();
    await page.waitForURL(/\/danger\/child$/, { timeout: 30_000 });
  });
});
