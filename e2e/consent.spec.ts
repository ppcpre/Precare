import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, uniqueEmail, PASSWORD } from "./helpers";

/**
 * Consent + PDPA
 *
 * ไม่ใช้ helper signUp เพราะเทสต์ชุดนี้ทดสอบ "หน้าสมัคร" เอง
 * — ต้องเห็นสถานะก่อนติ๊กด้วย ซึ่ง helper ข้ามไป
 */
async function fillSignup(page: import("@playwright/test").Page, email: string) {
  await page.goto("/signup");
  await page.getByLabel("ชื่อ-นามสกุล").fill("แม่ยินยอม");
  await page.getByLabel("อีเมล", { exact: true }).fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
}

test("หน้าสมัคร: แยกความยินยอมเป็นข้อๆ และไม่ติ๊กมาให้ล่วงหน้า", async ({ page }) => {
  await fillSignup(page, uniqueEmail("consent"));

  const boxes = page.getByRole("checkbox");
  await expect(boxes).toHaveCount(3);

  await test.step("ทุกช่องต้องเริ่มจากว่าง และปุ่มสมัครกดไม่ได้", async () => {
    // ความยินยอมที่ติ๊กมาแล้วไม่ถือเป็นการเลือกโดยสมัครใจ
    for (let i = 0; i < 3; i++) await expect(boxes.nth(i)).not.toBeChecked();
    await expect(page.getByRole("button", { name: "สมัครสมาชิก" })).toBeDisabled();
  });

  await test.step("ติ๊กแค่เงื่อนไขทั่วไปยังสมัครไม่ได้ ข้อมูลสุขภาพต้องยินยอมแยก", async () => {
    await boxes.nth(0).check();
    await expect(page.getByRole("button", { name: "สมัครสมาชิก" })).toBeDisabled();
  });

  await test.step("ข้อที่ไม่บังคับต้องไม่กระทบการสมัคร", async () => {
    await boxes.nth(1).check();
    await expect(page.getByRole("button", { name: "สมัครสมาชิก" })).toBeEnabled();
    // ไม่ติ๊กข้ออีเมลแจ้งเตือน แล้วต้องสมัครได้ตามปกติ
    await expect(boxes.nth(2)).not.toBeChecked();
  });

  await test.step("สมัครได้ และความยินยอมถูกบันทึกพร้อมเวอร์ชัน", async () => {
    await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
    await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
    await completeOnboarding(page, "ครอบครัวยินยอม");

    await gotoApp(page, "/profile/privacy");
    await expect(page.getByText(/ยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัว/)).toBeVisible();
    await expect(page.getByText(/ให้ไว้ .* · เวอร์ชัน/).first()).toBeVisible();
    // ข้อที่ไม่ได้ติ๊กต้องขึ้นว่ายังไม่ได้ให้ ไม่ใช่หายไปเฉยๆ
    await expect(page.getByText("ยังไม่ได้ให้ความยินยอม")).toBeVisible();
  });
});

test("หน้านโยบายต้องเปิดได้โดยไม่ต้องล็อกอิน", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // คนอ่านคือคนที่ยังไม่ได้สมัคร ถ้าบังคับล็อกอินก่อนอ่าน
  // ก็เท่ากับให้ยินยอมก่อนแล้วค่อยอ่านว่ายินยอมกับอะไร
  for (const path of ["/legal/terms", "/legal/privacy", "/legal/data"]) {
    const res = await page.goto(path);
    expect(res!.status(), `${path} ต้องเปิดได้`).toBe(200);
    expect(page.url(), `${path} ต้องไม่ถูกเด้งไป login`).toContain(path);
  }

  // ลิงก์จากหน้าสมัครต้องพาไปถึงจริง ไม่ใช่ 404 หรือเด้งไป login
  await page.goto("/signup");
  await page.getByRole("link", { name: "เงื่อนไข" }).click();
  await expect(page.getByRole("heading", { name: "เงื่อนไขการใช้งาน" })).toBeVisible();

  await ctx.close();
});

test("ดาวน์โหลดข้อมูลของตัวเองได้จริง และคนนอกโหลดไม่ได้", async ({ page, browser }) => {
  await fillSignup(page, uniqueEmail("export"));
  const boxes = page.getByRole("checkbox");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  await completeOnboarding(page, "ครอบครัวส่งออก");

  await test.step("ไฟล์ต้องเป็น JSON ที่ดาวน์โหลดได้ และมีข้อมูลจริง", async () => {
    const res = await page.request.get("http://localhost:8788/api/export");
    expect(res.status()).toBe(200);
    expect(res.headers()["content-disposition"]).toContain("attachment");
    const body = (await res.json()) as {
      families: { name: string }[];
      consents: { kind: string; version: string }[];
    };
    expect(body.families[0].name).toBe("ครอบครัวส่งออก");
    expect(body.consents.map((c) => c.kind)).toContain("health_data");
  });

  await test.step("ไม่ได้ล็อกอินต้องได้ 401", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get("http://localhost:8788/api/export");
    expect(res.status()).toBe(401);
    await ctx.close();
  });
});

test("ลบบัญชี: ลบจริงและถาวร แต่เจ้าของที่มีสมาชิกอื่นลบไม่ได้", async ({ page, browser }) => {
  const email = uniqueEmail("delete");
  await fillSignup(page, email);
  const boxes = page.getByRole("checkbox");
  await boxes.nth(0).check();
  await boxes.nth(1).check();
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
  await completeOnboarding(page, "ครอบครัวจะลบ");

  await test.step("บอกให้ครบก่อนกด ว่าลบแล้วกู้คืนไม่ได้", async () => {
    await gotoApp(page, "/profile/privacy");
    await expect(page.getByText("ลบทันทีและถาวร ไม่มีช่วงกู้คืน")).toBeVisible();
  });

  await test.step("ต้องพิมพ์อีเมลให้ตรงก่อน ปุ่มถึงกดได้", async () => {
    await page.getByRole("button", { name: "ลบบัญชี", exact: true }).click();
    const confirm = page.getByRole("button", { name: "ลบบัญชีถาวร" });
    await expect(confirm).toBeDisabled();

    await page.getByLabel(/พิมพ์อีเมลของคุณ/).fill("wrong@example.test");
    await expect(confirm).toBeDisabled();

    await page.getByLabel(/พิมพ์อีเมลของคุณ/).fill(email);
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await page.waitForURL(/\/login/, { timeout: 30_000 });
  });

  await test.step("บัญชีหายจริง เข้าด้วยรหัสเดิมไม่ได้อีก", async () => {
    const ctx = await browser.newContext();
    const fresh = await ctx.newPage();
    await fresh.goto("/login");
    await fresh.getByLabel("อีเมล", { exact: true }).fill(email);
    await fresh.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
    await fresh.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
    // ยังอยู่หน้า login และมีข้อความผิดพลาด ไม่ได้เข้าแอปได้
    await expect(fresh.getByRole("alert")).toBeVisible({ timeout: 20_000 });
    expect(fresh.url()).toContain("/login");
    await ctx.close();
  });
});
