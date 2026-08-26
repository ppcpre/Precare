import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  daysAhead,
  expectWeek,
  gotoApp,
  logIn,
  signUp,
  uniqueEmail,
} from "./helpers";

/**
 * T6.3 — เส้นทางหลักครบหนึ่งรอบ
 *
 * signup -> onboarding -> บันทึกสุขภาพ -> นัดหมาย -> เชิญสมาชิก -> รับคำเชิญ
 *
 * เขียนเป็น test เดียวแบบ serial เพราะแต่ละขั้นต้องใช้ผลของขั้นก่อนหน้า
 * แยกเป็นหลาย test แล้วต้อง seed state ซ้ำ ซึ่งทำให้เทสต์ห่างจากของจริง
 */
test.describe.configure({ mode: "serial" });

test("เจ้าของครอบครัวใช้งานครบหนึ่งรอบ แล้วเชิญสมาชิกเข้ามาได้", async ({
  page,
  browser,
}) => {
  const ownerEmail = uniqueEmail("owner");
  const viewerEmail = uniqueEmail("viewer");
  const familyName = "ครอบครัวทดสอบ";

  await test.step("สมัครสมาชิกแล้วถูกพาไป onboarding", async () => {
    await signUp(page, ownerEmail, "แม่ญาญ่า");
  });

  await test.step("ผ่าน onboarding แล้วเห็นอายุครรภ์บนหน้าแรก", async () => {
    await completeOnboarding(page, familyName);
  });

  await test.step("บันทึกสุขภาพ", async () => {
    await gotoApp(page, "/health/new");
    await page.getByLabel("น้ำหนัก").fill("58.5");
    await page.getByLabel("ตัวบน").fill("118");
    await page.getByLabel("ตัวล่าง").fill("76");
    await page.getByLabel("บันทึกเพิ่มเติม").fill("รู้สึกลูกดิ้นบ่อยขึ้น");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();

    await page.waitForURL(/\/health$/, { timeout: 30_000 });
    await expect(page.getByText("58.5")).toBeVisible();
    await expect(page.getByText("118/76")).toBeVisible();
  });

  await test.step("สร้างนัดหมาย", async () => {
    await gotoApp(page, "/appointments/new");
    await page.getByLabel("วันที่").fill(daysAhead(7));
    await page.getByLabel("เวลา").fill("09:30");
    await page.getByLabel("หัวข้อนัด").fill("ตรวจครรภ์ตามนัด");
    await page.getByLabel("แพทย์").fill("พญ. สมหญิง");
    await page.getByLabel("สถานที่").fill("รพ. ตัวอย่าง");
    await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();

    await page.waitForURL(/\/appointments$/, { timeout: 30_000 });
    await expect(page.getByText("ตรวจครรภ์ตามนัด")).toBeVisible();
  });

  let inviteUrl = "";

  await test.step("สร้างลิงก์เชิญระดับ viewer", async () => {
    await gotoApp(page, "/family/invite");
    await page.getByLabel("อีเมลผู้ถูกเชิญ").fill(viewerEmail);
    await page.getByRole("radio", { name: /ดูอย่างเดียว/ }).click();
    await page.getByRole("button", { name: "สร้างลิงก์เชิญ" }).click();

    await expect(page.getByText("สร้างลิงก์แล้ว")).toBeVisible();
    inviteUrl = (await page.getByText(/\/invite\//).first().innerText()).trim();
    expect(inviteUrl).toContain("/invite/");
  });

  await test.step("คนที่ถูกเชิญสมัครแล้วกดรับคำเชิญ เข้าครอบครัวเดียวกัน", async () => {
    // context ใหม่ = คนละเบราว์เซอร์ ไม่ใช้ cookie ของเจ้าของ
    const ctx = await browser.newContext();
    const guest = await ctx.newPage();

    await gotoApp(guest, "/signup");
    await guest.getByLabel("ชื่อ-นามสกุล").fill("คุณยาย");
    await guest.getByLabel("อีเมล").fill(viewerEmail);
    await guest.getByLabel("รหัสผ่าน", { exact: true }).fill("e2e-Passw0rd!");
    await guest.getByRole("checkbox").check();
    await guest.getByRole("button", { name: "สมัครสมาชิก" }).click();
    await guest.waitForURL(/\/onboarding/, { timeout: 30_000 });

    const path = new URL(inviteUrl.startsWith("http") ? inviteUrl : `http://x${inviteUrl}`).pathname;
    await guest.goto(path);
    await guest.getByRole("button", { name: "เข้าร่วมครอบครัว" }).click();
    await guest.waitForURL(/\/dashboard/, { timeout: 30_000 });

    // เห็นข้อมูลของครอบครัวที่เพิ่งเข้าร่วม ไม่ใช่ครอบครัวเปล่า
    await expectWeek(guest, 24);

    await test.step("viewer ต้องไม่เห็นปุ่มแก้ไขเลย ไม่ใช่แค่กดไม่ได้ (T5.9)", async () => {
      // ใช้ goto ธรรมดา ไม่ต้องรอ hydrate — หน้าที่ viewer เห็นไม่มีปุ่มสักปุ่ม
      // ตามดีไซน์อยู่แล้ว จึงไม่มี client component ให้รอ และเราแค่อ่านอย่างเดียว
      // ยืนยันว่าหน้า render จริงก่อน ไม่งั้น toHaveCount(0) ผ่านฟรีบนหน้าเปล่า
      await guest.goto("/health");
      await expect(guest.getByRole("heading", { name: "บันทึกสุขภาพ" })).toBeVisible();
      await expect(guest.getByRole("link", { name: /เพิ่มบันทึก/ })).toHaveCount(0);

      await guest.goto("/appointments");
      await expect(guest.getByRole("heading", { name: "นัดหมาย" })).toBeVisible();
      await expect(guest.getByRole("link", { name: /เพิ่มนัดหมาย/ })).toHaveCount(0);
    });

    await test.step("viewer เปิด URL แก้ไขตรงๆ ต้องถูกพากลับ ไม่ใช่เห็นฟอร์ม", async () => {
      // ตามดีไซน์: requireFamilyContext("editor") โยน AuthzError แล้วหน้า
      // redirect กลับ /health — ไม่ใช่ตอบ 403 เปล่าๆ ให้ผู้ใช้งง
      await guest.goto("/health/new");
      await expect(guest).toHaveURL(/\/health$/);
      await expect(guest.getByRole("button", { name: "บันทึก", exact: true })).toHaveCount(0);

      await guest.goto("/appointments/new");
      await expect(guest).toHaveURL(/\/appointments$/);

      await guest.goto("/album/upload");
      await expect(guest).not.toHaveURL(/\/album\/upload/);
    });

    await ctx.close();
  });

  await test.step("ล็อกอินใหม่แล้วข้อมูลยังอยู่", async () => {
    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await logIn(fresh, ownerEmail);
    await fresh.waitForURL(/\/dashboard/, { timeout: 30_000 });
    await expectWeek(fresh, 24);
    await ctx.close();
  });
});
