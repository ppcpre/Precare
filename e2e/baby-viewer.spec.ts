import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * viewer (เช่น คุณยาย) กับหน้าของลูกทั้งหมด
 *
 * หลักของแอป: viewer เห็นทุกอย่างของครอบครัว แต่ **ไม่เห็นปุ่มที่เขียนข้อมูลเลย**
 * (ซ่อน ไม่ใช่ disabled) และเปิด URL ของฟอร์มตรงๆ ต้องถูกพากลับ
 * ข้อยกเว้นเดียว: การแจ้งเตือนเป็นของคนตั้ง viewer ตั้งให้ตัวเองได้
 */
test("viewer เห็นบันทึก ยา และไข้ของลูก แต่ไม่มีปุ่มเขียน", async ({ page, browser }) => {
  test.setTimeout(180_000);
  const viewerEmail = uniqueEmail("babyviewer");
  await signUp(page, uniqueEmail("babyowner"), "แม่เจ้าของ");
  await completeOnboarding(page, "ครอบครัวมีคุณยาย");

  let childId = "";
  await test.step("เจ้าของ: เพิ่มลูก ผ้าอ้อม ยา ไข้", async () => {
    await gotoApp(page, "/baby");
    await page.getByLabel("ชื่อที่เรียก").fill("น้องหลาน");
    await page.getByLabel("วันเกิด").fill(daysAgo(25));
    await page.getByRole("button", { name: "เพิ่มลูก" }).click();
    await page.waitForURL(/\/baby\/[0-9a-f-]+$/, { timeout: 30_000 });
    childId = new URL(page.url()).pathname.split("/")[2];

    await gotoApp(page, `/baby/${childId}/log`);
    await page.getByRole("button", { name: /^ผ้าอ้อม/ }).click();
    await page.getByRole("dialog", { name: "ผ้าอ้อม" }).getByRole("button", { name: /^ฉี่/ }).click();
    await expect(page.getByRole("status").filter({ hasText: "บันทึกแล้ว" })).toBeVisible({ timeout: 15_000 });

    await gotoApp(page, `/baby/${childId}/meds/new`);
    await page.getByLabel("ชื่อยา").fill("ยาลดไข้ (น้ำ)");
    await page.getByRole("radio", { name: "4 ชม." }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/meds$/, { timeout: 30_000 });
    await page.getByRole("button", { name: "บันทึกว่าให้ยาแล้ว" }).click();
    await expect(page.getByText(/ให้ล่าสุด .* โดยคุณ/)).toBeVisible({ timeout: 15_000 });

    await gotoApp(page, `/baby/${childId}/temp`);
    await page.getByRole("button", { name: "เพิ่ม 0.1 องศา" }).click();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/temp\?saved=1$/, { timeout: 30_000 });
  });

  let inviteUrl = "";
  await test.step("เชิญคุณยายแบบดูอย่างเดียว", async () => {
    await gotoApp(page, "/family/invite");
    await page.getByLabel("อีเมลผู้ถูกเชิญ").fill(viewerEmail);
    await page.getByRole("radio", { name: /ดูอย่างเดียว/ }).click();
    await page.getByRole("button", { name: "สร้างลิงก์เชิญ" }).click();
    await expect(page.getByText("สร้างลิงก์แล้ว")).toBeVisible();
    inviteUrl = (await page.getByText(/\/invite\//).first().innerText()).trim();
  });

  const ctx = await browser.newContext();
  const v = await ctx.newPage();
  try {
    await signUp(v, viewerEmail, "คุณยาย");
    await v.goto(new URL(inviteUrl.startsWith("http") ? inviteUrl : `http://x${inviteUrl}`).pathname);
    await v.getByRole("button", { name: "เข้าร่วมครอบครัว" }).click();
    await v.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await test.step("หน้าแรก: เห็นการ์ดลูก แต่ปุ่มกดด่วนไม่ใช่ปุ่ม", async () => {
      await gotoApp(v, "/dashboard");
      const card = v.getByRole("region", { name: "บันทึกของน้องหลาน" });
      await expect(card).toBeVisible();
      await expect(card.getByRole("button", { name: /^(เต้า|ขวดนม|ผ้าอ้อม|อาบน้ำ)/ })).toHaveCount(0);
      await expect(card.getByRole("link", { name: /^(เต้า|นอน|ปั๊มนม)/ })).toHaveCount(0);
    });

    await test.step("หน้าวันนี้: เห็นรายการและใครบันทึก ไม่มีปุ่มลบ ไม่มีเพิ่มนัด", async () => {
      await gotoApp(v, `/baby/${childId}/log`);
      await expect(v.getByText("ผ้าอ้อม · ฉี่")).toBeVisible();
      await expect(v.getByText(/บันทึกโดย แม่เจ้าของ/).first()).toBeVisible();
      await expect(v.getByRole("button", { name: /^ลบ / })).toHaveCount(0);
      await expect(v.getByRole("link", { name: "เพิ่มนัดของลูก" })).toHaveCount(0);
      await expect(v.getByRole("link", { name: "ยาของลูก" })).toBeVisible();
    });

    await test.step("จับเวลาเต้า/นอน: ดูได้ แต่ไม่มีปุ่มเริ่ม", async () => {
      await gotoApp(v, `/baby/${childId}/log/breast`);
      await expect(v.getByRole("button", { name: /^(ซ้าย|ขวา)/ })).toHaveCount(0);
      await gotoApp(v, `/baby/${childId}/log/sleep`);
      await expect(v.getByRole("button", { name: "เริ่มนอน" })).toHaveCount(0);
    });

    await test.step("ยา: เห็นว่าใครให้ล่าสุด ไม่มีปุ่มบันทึกหรือเพิ่ม", async () => {
      await gotoApp(v, `/baby/${childId}/meds`);
      await expect(v.getByText("ยาลดไข้ (น้ำ)")).toBeVisible();
      await expect(v.getByText(/ให้ล่าสุด .* โดยแม่เจ้าของ/)).toBeVisible();
      await expect(v.getByRole("button", { name: "บันทึกว่าให้ยาแล้ว" })).toHaveCount(0);
      await expect(v.getByRole("link", { name: "เพิ่มยาของลูก" })).toHaveCount(0);
      await expect(v.getByRole("button", { name: /^ลบรายการให้ยา/ })).toHaveCount(0);
    });

    await test.step("ไข้: เห็นค่าที่วัด ไม่มีฟอร์ม", async () => {
      await gotoApp(v, `/baby/${childId}/temp`);
      await expect(v.getByText("37.1 °C")).toBeVisible();
      await expect(v.getByRole("button", { name: "เพิ่ม 0.1 องศา" })).toHaveCount(0);
      await expect(v.getByRole("button", { name: /^ลบ / })).toHaveCount(0);
    });

    await test.step("เปิด URL ฟอร์มตรงๆ ถูกพากลับ", async () => {
      await v.goto(`/baby/${childId}/meds/new`);
      await v.waitForURL(new RegExp(`/baby/${childId}/meds$`), { timeout: 30_000 });
      await v.goto("/baby/pump");
      await v.waitForURL(/\/dashboard$/, { timeout: 30_000 });
    });

    await test.step("การแจ้งเตือนเป็นของคนตั้ง — viewer ตั้งให้ตัวเองได้", async () => {
      await gotoApp(v, `/baby/${childId}/reminders/new`);
      await v.getByRole("button", { name: /^ผ้าอ้อม/ }).click();
      await v.getByRole("button", { name: "บันทึก", exact: true }).click();
      await v.waitForURL(/\/reminders$/, { timeout: 30_000 });
      await expect(v.getByText("เปลี่ยนผ้าอ้อม")).toBeVisible();
    });
  } finally {
    await ctx.close();
  }

  await test.step("เจ้าของไม่เห็นการแจ้งเตือนของคุณยาย", async () => {
    await gotoApp(page, `/baby/${childId}/reminders`);
    await expect(page.getByText("ยังไม่ได้ตั้งการแจ้งเตือน")).toBeVisible();
  });
});
