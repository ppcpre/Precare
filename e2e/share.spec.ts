import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, makePng, pickFiles, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — ปุ่มแชร์ส่ง "ตัวไฟล์" ผ่านแผงของเครื่อง ไม่ใช่ลิงก์
 *
 * navigator.share เรียกจากเทสต์ตรงๆ ไม่ได้ (ต้องมี user gesture จริงและแผง
 * ของระบบปฏิบัติการ) จึงสลับ navigator.canShare/share เป็นตัวปลอมก่อนโหลดหน้า
 * แล้วตรวจว่า "สิ่งที่ส่งเข้าไป" เป็นไฟล์จริงที่มีเนื้อ ไม่ใช่ url หรือ text
 */
test.describe.configure({ mode: "serial" });

test("กดแชร์แล้วส่งไฟล์จริงเข้าแผงของเครื่อง", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __shared?: { name: string; size: number; type: string }[] };
    w.__shared = [];
    Object.defineProperty(navigator, "canShare", { value: () => true, configurable: true });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: async (data: { files?: File[] }) => {
        for (const f of data.files ?? []) w.__shared!.push({ name: f.name, size: f.size, type: f.type });
      },
    });
  });

  await signUp(page, uniqueEmail("share"), "แม่แชร์");
  await completeOnboarding(page, "ครอบครัวแชร์");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [{ name: "s.png", mimeType: "image/png", buffer: makePng(900, 700, 11) }]);
  await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  await page.locator('img[src*="/photos/"]').first().click();
  await page.waitForURL(/\/album\/[0-9a-f-]{36}/, { timeout: 30_000 });

  await page.getByRole("button", { name: /แชร์/ }).click();

  type Shared = { name: string; size: number; type: string }[];
  const readShared = () => page.evaluate(() => (window as unknown as { __shared: Shared }).__shared);

  await expect.poll(async () => (await readShared()).length, { timeout: 30_000 }).toBeGreaterThan(0);
  const shared = await readShared();

  // ต้องเป็นไฟล์ที่มีเนื้อจริง ไม่ใช่ไฟล์เปล่าหรือ url
  expect(shared[0].size).toBeGreaterThan(0);
  expect(shared[0].type).toContain("image/");
  expect(shared[0].name).toMatch(/^precare-\d{4}-\d{2}-\d{2}/);
});

test("ดาวน์โหลดตรงต้องสั่งให้เบราว์เซอร์เซฟ ไม่ใช่เปิดดู", async ({ page }) => {
  await signUp(page, uniqueEmail("dl"), "แม่ดาวน์โหลด");
  await completeOnboarding(page, "ครอบครัวดาวน์โหลด");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [{ name: "d.png", mimeType: "image/png", buffer: makePng(800, 600, 12) }]);
  await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  const src = await page.locator('img[src*="/photos/"]').first().getAttribute("src");
  const key = new URL(src!, "http://localhost:8788").pathname.replace(/^\/(api\/media\/)?/, "");

  const res = await page.request.get(`http://localhost:8788/api/media/${key}?download=1`);
  expect(res.status()).toBe(200);
  expect(res.headers()["content-disposition"]).toMatch(/^attachment; filename="precare-/);

  // ไม่ใส่ ?download ต้องยังเปิดดูในหน้าได้เหมือนเดิม
  const inline = await page.request.get(`http://localhost:8788/api/media/${key}`);
  expect(inline.headers()["content-disposition"]).toBe("inline");
});
