import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, makePng, pickFiles, signUp, uniqueEmail } from "./helpers";

/**
 * T6.5 — ไฟล์ใน bucket private ต้องผูกสิทธิ์กับเจ้าของจริง
 *
 * เดิม /api/media/[...key] เช็คแค่ว่ามี session ไหม ใครมีบัญชีก็เปิดรูปของ
 * ครอบครัวอื่นได้ถ้ารู้ key ซึ่ง key เดาได้จากรูปแบบ family/<id>/photos/<uuid>
 */
test.describe.configure({ mode: "serial" });

test("คนนอกครอบครัวเปิดรูปด้วย URL ตรงๆ ไม่ได้", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("mediaowner"), "แม่เจ้าของรูป");
  await completeOnboarding(page, "ครอบครัวเจ้าของรูป");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [
    { name: "secret.png", mimeType: "image/png", buffer: makePng(1800, 1400, 9) },
  ]);
  await page.getByRole("button", { name: /เพิ่ม 1 รูปเข้าอัลบั้ม/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  const mediaUrl = await page
    .locator('img[src^="/api/media/"]')
    .first()
    .getAttribute("src");
  expect(mediaUrl).toBeTruthy();

  await test.step("เจ้าของเปิดได้ปกติ", async () => {
    const res = await page.request.get(mediaUrl!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/");
    // ห้าม public — CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
    expect(res.headers()["cache-control"]).toContain("private");
  });

  await test.step("คนที่ล็อกอินอยู่แต่คนละครอบครัว ต้องได้ 404", async () => {
    const ctx = await browser.newContext();
    const stranger = await ctx.newPage();
    await signUp(stranger, uniqueEmail("stranger"), "คนแปลกหน้า");
    await completeOnboarding(stranger, "ครอบครัวคนแปลกหน้า");

    const res = await stranger.request.get(mediaUrl!);
    // 404 ไม่ใช่ 403 — คนนอกไม่ควรรู้ด้วยซ้ำว่าไฟล์นี้มีอยู่จริง
    expect(res.status()).toBe(404);

    await ctx.close();
  });

  await test.step("ไม่ได้ล็อกอินต้องได้ 401", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get(`http://localhost:8788${mediaUrl}`);
    expect(res.status()).toBe(401);
    await ctx.close();
  });
});
