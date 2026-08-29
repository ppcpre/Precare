import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  daysAgo,
  gotoApp,
  makePng,
  pickFiles,
  signUp,
  uniqueEmail,
} from "./helpers";

/**
 * Regression — อัปโหลดรูปเข้าอัลบั้ม
 *
 * บั๊กที่เคยหลุดขึ้น production: เลือกไฟล์แล้วไม่ขึ้นรูปเลย เพราะ onChange
 * เคลียร์ input.value ก่อนอ่าน FileList (เป็น object ตัวเดียวกัน) และ Server
 * Action มี body limit 1 MB ซึ่งเล็กกว่ารูปชุดเดียวที่ย่อแล้ว
 *
 * unit test จับไม่ได้ทั้งคู่ — ตัวแรกเป็น DOM semantics ล้วน ส่วนตัวที่สอง
 * โผล่ตอน runtime เท่านั้น เทสต์นี้คือ gate ของสองเรื่องนั้น
 */
test.describe.configure({ mode: "serial" });

test("เลือกไฟล์แล้วขึ้น preview อัปโหลดได้ และเรียงใหม่ไปเก่า", async ({ page }) => {
  await signUp(page, uniqueEmail("album"), "แม่อัลบั้ม");
  await completeOnboarding(page, "ครอบครัวอัลบั้ม");

  await gotoApp(page, "/album/upload");

  /**
   * ใหญ่กว่า PHOTO_EDGE (1600) เพื่อให้เดินผ่าน path ย่อรูปจริง
   * และเป็น noise เพื่อให้ย่อแล้วยังเกิน 1 MB (ทดสอบ bodySizeLimit จริง)
   *
   * ใช้ 2 ใบไม่ใช่ 3 — บน runner 2 คอร์ การเสิร์ฟรูปใหญ่พร้อมกันหลายใบ
   * ทำให้ worker ใช้เวลาต่อคำขอพุ่งเป็นวินาที และเคยทำให้ wrangler dev ตายกลางคัน
   * 2 ใบยังเกิน 1 MB ตามที่ assertion ต้องการ แต่กดดันเครื่องน้อยกว่าครึ่ง
   */
  const files = [0, 1].map((i) => ({
    name: `photo-${i}.png`,
    mimeType: "image/png",
    buffer: makePng(1700, 1300, i),
  }));

  await pickFiles(page, files);

  await test.step("preview ต้องขึ้นครบทุกใบ", async () => {
    // จุดที่บั๊กเดิมพัง — ได้ FileList ว่างจึงไม่มี blob สักใบ
    await expect(page.locator('img[src^="blob:"]')).toHaveCount(2, { timeout: 30_000 });
    await expect(page.getByText(/2 รูป · รวม/)).toBeVisible();
  });

  await test.step("ย่อรูปแล้วเล็กลงจริง แต่ยังใหญ่พอจะกดดัน body limit", async () => {
    const originalKb = Math.round(files.reduce((n, f) => n + f.buffer.length, 0) / 1024);
    const label = await page.getByText(/รวม .*(KB|MB)/).innerText();
    const [, num, unit] = label.match(/รวม ([\d.]+) (KB|MB)/) ?? [];
    const resizedKb = unit === "MB" ? Number(num) * 1024 : Number(num);

    expect(resizedKb).toBeLessThan(originalKb / 2);
    // ถ้าชุดทดสอบเล็กกว่า 1 MB เทสต์ข้างล่างจะผ่านแม้ bodySizeLimit จะกลับไป
    // เป็นค่า default ที่พังอยู่ — เช็คไว้ตรงนี้ไม่ให้เทสต์กลายเป็นของปลอมเงียบๆ
    expect(resizedKb, "ชุดทดสอบต้องเกิน 1 MB ไม่งั้นไม่ได้ทดสอบ body limit จริง")
      .toBeGreaterThan(1024);
  });

  await test.step("อัปโหลดผ่าน — ตัวชี้ขาดว่า bodySizeLimit พอ", async () => {
    await page.getByRole("button", { name: /เพิ่ม 2 รูปเข้าอัลบั้ม/ }).click();
    await page.waitForURL(/\/album$/, { timeout: 45_000 });
    // นับ 2 รูป โผล่ทั้งหัวเดือนและหัววัน เอาตัวแรกพอ
    await expect(page.getByText("2 รูป").first()).toBeVisible();
  });

  await test.step("รูปโหลดขึ้นจริง ไม่ใช่กรอบว่าง", async () => {
    const tiles = page.locator('img[src^="/api/media/"]');
    await expect(tiles).toHaveCount(2);
    for (let i = 0; i < 2; i++) {
      await expect
        .poll(() => tiles.nth(i).evaluate((el: HTMLImageElement) => el.naturalWidth))
        .toBeGreaterThan(0);
    }
  });

  await test.step("แถบโควตาต้องขยับขึ้นจากศูนย์", async () => {
    await expect(page.getByText(/\/ 5\.00 GB/)).toBeVisible();
    await expect(page.getByText(/^0 B \//)).toHaveCount(0);
  });
});

test("ไฟล์ที่เปิดไม่ได้ต้องไม่ทำให้ทั้งชุดหาย", async ({ page }) => {
  await signUp(page, uniqueEmail("badfile"), "แม่ไฟล์เสีย");
  await completeOnboarding(page, "ครอบครัวไฟล์เสีย");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [
    { name: "ok.png", mimeType: "image/png", buffer: makePng(1800, 1400, 5) },
    { name: "broken.png", mimeType: "image/png", buffer: Buffer.from("ไม่ใช่ PNG จริง") },
  ]);

  // ใบที่ดีต้องรอด และต้องบอกชื่อใบที่เปิดไม่ได้
  await expect(page.locator('img[src^="blob:"]')).toHaveCount(1, { timeout: 30_000 });
  await expect(page.getByText(/broken\.png/)).toBeVisible();
});

test("บันทึกสุขภาพต้องลิงก์ไปเพิ่มรูปพร้อม logId", async ({ page }) => {
  await signUp(page, uniqueEmail("loglink"), "แม่ลิงก์");
  await completeOnboarding(page, "ครอบครัวลิงก์");

  await gotoApp(page, "/health/new");
  await page.getByLabel("น้ำหนัก").fill("60");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.waitForURL(/\/health$/, { timeout: 30_000 });

  await page.getByRole("link", { name: /แก้ไขบันทึก/ }).first().click();
  await page.waitForURL(/\/health\/.+\/edit/, { timeout: 30_000 });

  const link = page.getByRole("link", { name: /เพิ่มรูปเข้าบันทึกนี้/ });
  await expect(link).toBeVisible();
  expect(await link.getAttribute("href")).toMatch(/^\/album\/upload\?logId=.+/);
});

/**
 * จัดกลุ่มตามเดือน/วัน — บั๊กเดิมคือหัวกลุ่มเอาวันที่ของรูปใบแรกมาแปะทั้งกลุ่ม
 * ทั้งที่ในกลุ่มมีรูปจากหลายวัน
 */
test("รูปหลายวันต้องแยกหัววันจากกัน และสัปดาห์เป็นแท็ก", async ({ page }) => {
  await signUp(page, uniqueEmail("albumdays"), "แม่หลายวัน");
  await completeOnboarding(page, "ครอบครัวหลายวัน");

  const upload = async (takenAt: string, caption: string) => {
    await gotoApp(page, "/album/upload");
    await pickFiles(page, [
      { name: `${takenAt}.png`, mimeType: "image/png", buffer: makePng(900, 700, takenAt.length) },
    ]);
    await page.getByLabel("วันที่ถ่าย").fill(takenAt);
    await page.getByLabel("คำบรรยาย").fill(caption);
    await page.getByRole("button", { name: /เพิ่ม 1 รูปเข้าอัลบั้ม/ }).click();
    await page.waitForURL(/\/album$/, { timeout: 45_000 });
  };

  // สามวันในเดือนเดียวกัน + อีกใบคนละเดือน
  await upload(daysAgo(2), "รูปวันล่าสุด");
  await upload(daysAgo(4), "รูปอีกวัน");
  await upload(daysAgo(40), "รูปเดือนก่อน");

  await test.step("หัวเดือน 2 กลุ่ม หัววัน 3 กลุ่ม ไม่ยุบรวมกัน", async () => {
    // นับจากโครงสร้างหัวข้อ ไม่ใช่จากข้อความ "N รูป" ซึ่งโผล่ทั้งหัวเดือนและหัววัน
    await expect(page.locator("main h2")).toHaveCount(2);
    await expect(page.locator("main h3")).toHaveCount(3);
  });

  await test.step("หัววันบอกวันในสัปดาห์ด้วย", async () => {
    const text = await page.locator("main h3").first().innerText();
    expect(text).toMatch(/(อาทิตย์|จันทร์|อังคาร|พุธ|พฤหัสบดี|ศุกร์|เสาร์)/);
  });

  await test.step("สัปดาห์เป็นแท็ก ไม่ใช่หัวกลุ่ม", async () => {
    const text = await page.locator("main").innerText();
    // แบบเดิมขึ้น "สัปดาห์ที่ 24" เป็นหัวกลุ่ม แบบใหม่เป็นแท็ก "สัปดาห์ 24"
    expect(text).not.toContain("สัปดาห์ที่");
    expect(text).toMatch(/สัปดาห์ \d+/);
  });
});

test("มุมมองที่เลือกต้องจำข้ามการเปิดหน้าใหม่", async ({ page }) => {
  await signUp(page, uniqueEmail("albumview"), "แม่มุมมอง");
  await completeOnboarding(page, "ครอบครัวมุมมอง");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [
    { name: "v.png", mimeType: "image/png", buffer: makePng(900, 700, 3) },
  ]);
  await page.getByLabel("คำบรรยาย").fill("คำบรรยายทดสอบ");
  await page.getByRole("button", { name: /เพิ่ม 1 รูปเข้าอัลบั้ม/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  await test.step("default คือตาราง จึงยังไม่เห็นคำบรรยาย", async () => {
    await expect(page.getByRole("button", { name: "ตาราง" })).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("คำบรรยายทดสอบ")).toHaveCount(0);
  });

  await test.step("สลับเป็นรายละเอียดแล้วเห็นคำบรรยาย", async () => {
    await page.getByRole("button", { name: "รายละเอียด" }).click();
    await expect(page.getByText("คำบรรยายทดสอบ")).toBeVisible();
  });

  await test.step("เปิดหน้าใหม่ต้องยังเป็นรายละเอียด", async () => {
    await gotoApp(page, "/album");
    await expect(page.getByRole("button", { name: "รายละเอียด" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    await expect(page.getByText("คำบรรยายทดสอบ")).toBeVisible();
  });
});
