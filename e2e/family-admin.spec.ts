import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — จัดการสมาชิกและคำเชิญ
 *
 * ทั้งสองอย่างเป็นการกระทำที่ย้อนกลับไม่ได้ (ลิงก์ที่ส่งไปแล้วใช้ไม่ได้อีก /
 * คนที่ถูกนำออกเห็นข้อมูลไม่ได้อีก) และเป็นด่านความเป็นส่วนตัวของข้อมูลสุขภาพ
 * จึงต้องมีเทสต์ยืนยันว่ากดแล้วเกิดผลจริง ไม่ใช่แค่ปุ่มขึ้น
 */
test.describe.configure({ mode: "serial" });

test("ยกเลิกคำเชิญที่ยังไม่ตอบรับได้ และลิงก์เดิมใช้ไม่ได้อีก", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("fadmin"), "แม่เจ้าของบ้าน");
  await completeOnboarding(page, "ครอบครัวจัดการ");

  const guestEmail = uniqueEmail("guest");
  let inviteUrl = "";

  await test.step("สร้างคำเชิญ", async () => {
    await gotoApp(page, "/family/invite");
    await page.getByLabel("อีเมลผู้ถูกเชิญ").fill(guestEmail);
    await page.getByRole("button", { name: "สร้างลิงก์เชิญ" }).click();
    inviteUrl = (await page.getByText(/\/invite\//).first().innerText()).trim();
    expect(inviteUrl).toContain("/invite/");
  });

  await test.step("คำเชิญขึ้นในหน้าครอบครัว พร้อมปุ่มคัดลอกและยกเลิก", async () => {
    await page.goto("/family");
    await expect(page.getByText(guestEmail)).toBeVisible();
    await expect(page.getByRole("button", { name: new RegExp(`คัดลอกลิงก์คำเชิญของ ${guestEmail}`) })).toBeVisible();
  });

  await test.step("กดยกเลิกแล้วคำเชิญหายจากรายการ", async () => {
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: new RegExp(`ยกเลิกคำเชิญของ ${guestEmail}`) }).click();
    await expect(page.getByText(guestEmail)).toHaveCount(0, { timeout: 30_000 });
  });

  await test.step("ลิงก์เดิมใช้ไม่ได้อีก — คนที่ได้ลิงก์ไปแล้วเข้าไม่ได้", async () => {
    const ctx = await browser.newContext();
    const guest = await ctx.newPage();
    await signUp(guest, guestEmail, "คนถูกเชิญ");

    const path = new URL(inviteUrl.startsWith("http") ? inviteUrl : `http://x${inviteUrl}`).pathname;
    await guest.goto(path);
    // ต้องไม่มีปุ่มรับคำเชิญให้กดอีก
    await expect(guest.getByRole("button", { name: /รับคำเชิญ|เข้าร่วม/ })).toHaveCount(0);
    await ctx.close();
  });
});

test("นำสมาชิกออกจากครอบครัวได้ และเขาเข้าข้อมูลไม่ได้อีก", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("owner2"), "แม่เจ้าของบ้าน");
  await completeOnboarding(page, "ครอบครัวนำออก");

  const memberEmail = uniqueEmail("member2");
  let inviteUrl = "";

  await gotoApp(page, "/family/invite");
  await page.getByLabel("อีเมลผู้ถูกเชิญ").fill(memberEmail);
  await page.getByRole("button", { name: "สร้างลิงก์เชิญ" }).click();
  inviteUrl = (await page.getByText(/\/invite\//).first().innerText()).trim();

  const ctx = await browser.newContext();
  const member = await ctx.newPage();
  await signUp(member, memberEmail, "สมาชิกใหม่");
  const path = new URL(inviteUrl.startsWith("http") ? inviteUrl : `http://x${inviteUrl}`).pathname;
  await member.goto(path);
  await member.getByRole("button", { name: /รับคำเชิญ|เข้าร่วม/ }).first().click();
  await member.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await test.step("เจ้าของเห็นสมาชิกใหม่ แล้วกดนำออก", async () => {
    await page.goto("/family");
    await expect(page.getByText("สมาชิกใหม่")).toBeVisible();

    // ตัวเปิดเมนูเป็น <summary> ไม่ใช่ <button> role จึงไม่ใช่ button
    await page.getByLabel("ตัวเลือกสำหรับ สมาชิกใหม่").click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "นำออกจากครอบครัว" }).click();
    await expect(page.getByText("สมาชิกใหม่")).toHaveCount(0, { timeout: 30_000 });
  });

  await test.step("คนที่ถูกนำออกเปิดข้อมูลครอบครัวไม่ได้อีก", async () => {
    await member.goto("/family");
    // ถูกเด้งออกจากหน้าครอบครัว หรือไม่เห็นชื่อครอบครัวนั้นอีกต่อไป
    await expect(member.getByText("ครอบครัวนำออก")).toHaveCount(0, { timeout: 30_000 });
  });

  await ctx.close();
});
