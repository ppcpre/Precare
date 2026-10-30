import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Phase 2 — การ์ดพัฒนาการรายสัปดาห์ (ขนาด + พัฒนาการ อยู่ใบเดียวกัน)
 *
 * onboarding ใน helper ตั้ง LMP ย้อนหลัง 168 วัน = 24 สัปดาห์ 0 วันพอดี
 * เนื้อหาที่คาดหวังจึงตรึงไว้ที่สัปดาห์ 24 ได้
 */
test("หน้าแรกแสดงขนาดและพัฒนาการของสัปดาห์ปัจจุบัน", async ({ page, isMobile }) => {
  await signUp(page, uniqueEmail("weekly"), "แม่รายสัปดาห์");
  await completeOnboarding(page, "ครอบครัวรายสัปดาห์");

  await expect(page.getByRole("heading", { name: "พัฒนาการของลูกน้อย" })).toBeVisible();
  await expect(page.getByText("ข้าวโพด")).toBeVisible();
  await expect(page.getByText("30 ซม.")).toBeVisible();
  // WHO ตารางที่ 11 สัปดาห์ 24 — ของเดิมเป็น 600 ก. ซึ่งต่ำกว่าความจริง 10%
  await expect(page.getByText("665 ก.")).toBeVisible();
  await expect(page.getByText("ช่วงปกติ 576–765 ก.")).toBeVisible();

  await expect(page.getByText(/ปอดพัฒนาครบโครงสร้างแล้ว/)).toBeVisible();

  // กล่องตัวเลขต้องกว้างจนชนขอบในของการ์ด ไม่ใช่หดตามความยาวข้อความ
  // แล้วเหลือที่ว่างทางขวา — เคยเป็นแบบนั้นเพราะคอลัมน์ไม่มี flex-1
  const rightGap = await page
    .getByRole("heading", { name: "พัฒนาการของลูกน้อย" })
    .locator("../..")
    .evaluate((card) => {
      const chips = card.querySelector('[data-testid="size-chips"]');
      if (!chips) return NaN;
      const pad = parseFloat(getComputedStyle(card).paddingRight);
      return card.getBoundingClientRect().right - pad - chips.getBoundingClientRect().right;
    });
  expect(rightGap, "กล่องตัวเลขต้องชนขอบในของการ์ด").toBeLessThan(2);

  /**
   * ข้อมูลทางการแพทย์ต้องมีข้อความกำกับเสมอ ไม่ใช่ทางเลือก
   *
   * เช็คใจความ ไม่ใช่คำเป๊ะๆ — ตอนเปลี่ยนมาใช้ WHO คำว่า "ค่าเฉลี่ย" ถูกเขียน
   * ทิ้งไปพร้อมกับใจความว่าลูกแต่ละคนต่างกันได้ ซึ่งเป็นครึ่งหนึ่งของเหตุผล
   * ที่ข้อความนี้มีอยู่ สองอย่างนี้ห้ามหายไม่ว่าจะเรียบเรียงใหม่กี่รอบ
   */
  const note = page.getByTestId("weekly-disclaimer");
  await expect(note).toContainText(/ต่างกันได้|ค่าเฉลี่ย/);
  await expect(note).toContainText("ไม่ใช่คำแนะนำทางการแพทย์");

  // ต้องพอดีบรรทัดเดียวบนมือถือ — ถ้าข้อความยาวขึ้นจนตกบรรทัดที่สอง ให้แดง
  //
  // นับ "จำนวนบรรทัด" จากความสูงหารด้วย line-height ของตัวมันเอง ไม่ใช่เทียบ
  // พิกเซลตายตัว — ตัวเลขตายตัวผูกกับฟอนต์ที่เครื่องนั้นมี เครื่องอื่นเลขจะเพี้ยน
  if (isMobile) {
    const lines = await note.evaluate((el) => {
      const lh = parseFloat(getComputedStyle(el).lineHeight);
      return Math.round(el.getBoundingClientRect().height / lh);
    });
    expect(lines, "ข้อความกำกับต้องไม่เกินหนึ่งบรรทัด").toBe(1);
  }

  // รวมเป็นใบเดียวแล้ว — ถ้าการ์ดเก่าโผล่กลับมาคือมีสองใบซ้อนกันอีก
  await expect(page.getByRole("heading", { name: "ขนาดของลูกน้อย" })).toHaveCount(0);
});

test("รูปเทียบขนาดโหลดไม่ขึ้น ต้องขึ้นไอคอนแทน ไม่ใช่รูปพัง", async ({ page }) => {
  // ตัดคำขอรูปทิ้งเอง ไม่พึ่งว่า "R2 ว่างอยู่" — พออัปไฟล์จริงขึ้นไปแล้ว
  // เทสต์ที่พึ่งความว่างจะกลายเป็นของปลอมที่ผ่านตลอดโดยไม่ได้ทดสอบอะไร
  await page.route("**/api/asset/weekly/size/**", (r) => r.abort());

  await signUp(page, uniqueEmail("fallback"), "แม่ฟอลแบ็ก");
  await completeOnboarding(page, "ครอบครัวฟอลแบ็ก");

  const card = page.getByRole("heading", { name: "พัฒนาการของลูกน้อย" }).locator("../..");
  // ต้องไม่เหลือ <img> ที่โหลดไม่ขึ้นค้างไว้ ไม่งั้นเบราว์เซอร์วาดไอคอนรูปพังให้
  await expect(card.locator('img[src*="/api/asset/"]')).toHaveCount(0);
  await expect(card.locator("svg").first()).toBeVisible();
});

/** 1x1 png โปร่งใส — เล็กที่สุดที่ยังเป็นไฟล์ภาพที่เบราว์เซอร์ถอดรหัสได้จริง */
const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

test("รูปเทียบขนาดโหลดขึ้น ต้องใช้รูปนั้น ไม่ใช่ตกไปที่ไอคอน", async ({ page }) => {
  await page.route("**/api/asset/weekly/size/**", (r) =>
    r.fulfill({ status: 200, contentType: "image/png", body: TINY_PNG }),
  );

  await signUp(page, uniqueEmail("hasimg"), "แม่มีรูป");
  await completeOnboarding(page, "ครอบครัวมีรูป");

  const card = page.getByRole("heading", { name: "พัฒนาการของลูกน้อย" }).locator("../..");
  const img = card.locator('img[src*="/api/asset/"]');
  await expect(img).toHaveCount(1);
  await expect
    .poll(() => img.evaluate((el: HTMLImageElement) => el.naturalWidth))
    .toBeGreaterThan(0);
});

test("รูปประกอบต้อง cache แบบ public ได้ ต่างจากรูปของผู้ใช้", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("assetcache"), "แม่แคช");
  await completeOnboarding(page, "ครอบครัวแคช");

  // /api/asset ไม่มีข้อมูลผู้ใช้ จึงต้องเปิดได้โดยไม่ต้องล็อกอิน
  // (ตรงข้ามกับ /api/media ที่ต้อง 401)
  const anon = await browser.newContext();
  const res = await anon.request.get("http://localhost:8788/api/asset/weekly/size/w24.webp");
  expect(res.status()).not.toBe(401);
  expect(res.status()).not.toBe(302);
  await anon.close();
});

/**
 * Regression — ปุ่มเพิ่มบนหน้า list ต้องไม่โผล่คู่กับ FAB บนมือถือ
 *
 * cn() เป็นแค่ join ไม่ได้ merge class ที่ชนกัน การใส่ hidden ทับ inline-flex
 * ของปุ่มจึงไม่ได้ผล ลำดับใน CSS เป็นตัวตัดสิน ทำให้ทั้งสามหน้ามี CTA ซ้ำ
 */
test("มือถือเห็น FAB อย่างเดียว เดสก์ท็อปเห็นปุ่มบนหัวข้ออย่างเดียว", async ({ page }, testInfo) => {
  await signUp(page, uniqueEmail("cta"), "แม่ซีทีเอ");
  await completeOnboarding(page, "ครอบครัวซีทีเอ");

  const mobile = testInfo.project.name === "mobile";
  // fab เขียนแยกเพราะ aria-label ของ FAB ไม่ได้ตรงกับข้อความบนปุ่มเสมอไป
  const pages: { path: string; title: string; label: string; fab: string }[] = [
    { path: "/health", title: "บันทึกสุขภาพ", label: "เพิ่มบันทึก", fab: "เพิ่มบันทึกสุขภาพ" },
    { path: "/appointments", title: "นัดหมายแพทย์", label: "เพิ่มนัดหมาย", fab: "เพิ่มนัดหมาย" },
    { path: "/album", title: "อัลบั้ม", label: "เพิ่มไฟล์", fab: "เพิ่มรูปหรือวิดีโอ" },
  ];

  for (const { path, title, label, fab: fabLabel } of pages) {
    await page.goto(path);
    // จำกัดขอบเขตไว้ที่แถวหัวข้อ ไม่งั้นไปชนกับลิงก์ชื่อเดียวกันใน empty state
    const headerRow = page.getByRole("heading", { name: title, exact: true }).locator("..");
    const topButton = headerRow.getByRole("link", { name: label });
    const fab = page.locator(`a.fixed[aria-label="${fabLabel}"]`);

    if (mobile) {
      await expect(topButton, `${path} มือถือไม่ควรมีปุ่มบนหัวข้อ`).toHaveCount(0);
      await expect(fab, `${path} มือถือควรมี FAB`).toBeVisible();
    } else {
      await expect(topButton, `${path} เดสก์ท็อปควรมีปุ่มบนหัวข้อ`).toBeVisible();
      await expect(fab, `${path} เดสก์ท็อปไม่ควรมี FAB`).toBeHidden();
    }
  }
});

/**
 * Regression — หน่วยของช่วงน้ำหนัก
 *
 * สัปดาห์ 27 เป็นสัปดาห์เดียวที่ขอบล่างยังไม่ถึงกิโล (898 ก.) แต่ขอบบนเกินแล้ว
 * (1,196 ก.) ถ้าตัดหน่วยตัวหน้าทิ้งแบบสัปดาห์อื่น จะอ่านเป็น "898–1.20 กก."
 * ซึ่งผิดไปคนละโลก — และเป็นเคสที่หลุดง่ายเพราะมีอยู่สัปดาห์เดียวใน 27 สัปดาห์
 */
test("ช่วงน้ำหนักที่คร่อมหลักกิโล ต้องมีหน่วยกำกับทั้งสองข้าง", async ({ page }) => {
  await signUp(page, uniqueEmail("range"), "แม่ช่วงน้ำหนัก");
  await completeOnboarding(page, "ครอบครัวช่วงน้ำหนัก");

  await gotoApp(page, "/profile/pregnancy");
  const lmp = new Date();
  lmp.setDate(lmp.getDate() - 27 * 7);
  await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(lmp.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await expect(page.getByText("1.04 กก.")).toBeVisible();
  await expect(page.getByText("ช่วงปกติ 898 ก.–1.20 กก.")).toBeVisible();
});

/**
 * ก่อนสัปดาห์ 14 ไม่มีเกณฑ์ของ WHO — ต้องบอกว่าเป็นค่าประมาณ ไม่ใช่เงียบ
 *
 * ถ้าวันหนึ่งมีคนเติมช่วงปกติให้สัปดาห์ต้นๆ เพื่อให้ "ดูครบ" มันจะกลายเป็น
 * ตัวเลขที่เราแต่งขึ้นเองแล้วติดป้ายว่าเป็นเกณฑ์
 */
test("สัปดาห์ก่อน 14 บอกว่าน้ำหนักเป็นค่าประมาณ ไม่แสดงช่วงปกติ", async ({ page }) => {
  await signUp(page, uniqueEmail("approx"), "แม่ไตรมาสแรก");
  await completeOnboarding(page, "ครอบครัวไตรมาสแรก");

  await gotoApp(page, "/profile/pregnancy");
  const lmp = new Date();
  lmp.setDate(lmp.getDate() - 12 * 7);
  await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(lmp.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await expect(page.getByText("14 ก.")).toBeVisible();
  await expect(page.getByText(/ยังไม่มีเกณฑ์มาตรฐาน/)).toBeVisible();
  await expect(page.getByText(/ช่วงปกติ/)).toHaveCount(0);
});

/**
 * Regression — รอยต่อของความยาวที่สัปดาห์ 25 ต้องอธิบายได้
 *
 * ความยาวกระโดดจาก 30.0 เป็น 34.6 ซม. ในสัปดาห์เดียว (สัปดาห์อื่นเพิ่ม ~1.1)
 * เป็นข้อบกพร่องของข้อมูลที่ยังหาแหล่งมาแทนไม่ได้ สิ่งที่ทำได้คือบอกผู้ใช้ตรงๆ
 * ถ้าวันหนึ่งคำอธิบายหาย ผู้ใช้จะเห็นลูกยาวขึ้น 4.6 ซม. ในเจ็ดวันโดยไม่มีคำตอบ
 */
test("สัปดาห์ 25 ต้องอธิบายได้ว่าทำไมความยาวกระโดด", async ({ page }) => {
  await signUp(page, uniqueEmail("jump"), "แม่รอยต่อ");
  await completeOnboarding(page, "ครอบครัวรอยต่อ");

  await gotoApp(page, "/profile/pregnancy");
  const lmp = new Date();
  lmp.setDate(lmp.getDate() - 25 * 7);
  await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(lmp.toISOString().slice(0, 10));
  await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await expect(page.getByText("34.6 ซม.")).toBeVisible();
  const why = page.getByRole("button", { name: /ทำไมตัวเลขเพิ่มขึ้นเยอะ/ });
  await expect(why).toBeVisible();
  await why.click();
  await expect(page.getByText(/วัดโดยตรงไม่ได้/)).toBeVisible();
});

test("สัปดาห์ที่ไม่มีรอยต่อ ต้องไม่ขึ้นคำอธิบายให้รก", async ({ page }) => {
  await signUp(page, uniqueEmail("nojump"), "แม่ไม่มีรอย");
  await completeOnboarding(page, "ครอบครัวไม่มีรอย");
  // onboarding ตั้งไว้ 24 สัปดาห์ ซึ่งอยู่กลางช่วงที่ต่อเนื่องดี
  await expect(page.getByRole("button", { name: /ทำไมตัวเลขเพิ่มขึ้นเยอะ/ })).toHaveCount(0);
});
