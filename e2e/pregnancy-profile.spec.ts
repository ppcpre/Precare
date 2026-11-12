import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — ส่วนสูง/น้ำหนักก่อนตั้งครรภ์ และประวัติการแก้
 *
 * สองค่านี้เป็นต้นทางของเกณฑ์น้ำหนักทั้งหมด แก้ทีเดียวช่วงเกณฑ์ขยับทั้งกราฟ
 * ในแอปที่คนทั้งครอบครัวเห็นข้อมูลเดียวกัน ต้องตอบได้ว่าใครแก้ตอนไหน
 */
test.describe.configure({ mode: "serial" });

test("กรอกส่วนสูง/น้ำหนัก แก้ได้ และมีประวัติว่าใครแก้จากอะไรเป็นอะไร", async ({ page }) => {
  await signUp(page, uniqueEmail("preg"), "แม่ชั่งน้ำหนัก");
  await completeOnboarding(page, "ครอบครัวชั่งน้ำหนัก");

  await test.step("กรอกครั้งแรก แล้วเห็น BMI กับช่วงเกณฑ์ทันที", async () => {
    await gotoApp(page, "/profile/pregnancy");
    await page.getByLabel("ส่วนสูง (ซม.)").fill("160");
    await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("52");

    // 52 / 1.6² = 20.3 → เกณฑ์ปกติ → 11.5-16 กก.
    await expect(page.getByText(/BMI ก่อนตั้งครรภ์/)).toContainText("20.3");
    await expect(page.getByText(/เกณฑ์ปกติ/)).toBeVisible();
    await expect(page.getByText(/11\.5–16 กก\./)).toBeVisible();

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  await test.step("ค่าที่กรอกต้องอยู่ครบเมื่อกลับมา", async () => {
    await gotoApp(page, "/profile/pregnancy");
    await expect(page.getByLabel("ส่วนสูง (ซม.)")).toHaveValue("160");
    await expect(page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)")).toHaveValue("52");
  });

  await test.step("แก้น้ำหนักแล้วช่วงเกณฑ์ขยับตาม", async () => {
    await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("70");
    // 70 / 1.6² = 27.3 → น้ำหนักเกิน → 7-11.5 กก.
    await expect(page.getByText(/น้ำหนักเกิน/)).toBeVisible();
    await expect(page.getByText(/7–11\.5 กก\./)).toBeVisible();
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  });

  await test.step("ประวัติบอกว่าใครแก้ จากอะไรเป็นอะไร", async () => {
    await gotoApp(page, "/profile/pregnancy");
    const history = page.getByText("ประวัติการแก้ไข").locator("..");
    await expect(history).toContainText("น้ำหนักก่อนตั้งครรภ์: 52 กก. → 70 กก.");
    await expect(history).toContainText("แม่ชั่งน้ำหนัก");
    // ครั้งแรกที่กรอกก็ต้องถูกบันทึกด้วย ไม่ใช่เฉพาะการแก้ครั้งหลัง
    await expect(history).toContainText("ยังไม่ได้กรอก → 160 ซม.");
  });
});

/**
 * Regression — การ์ดน้ำหนักในหน้าสุขภาพ
 *
 * การ์ดนี้บอกคนท้องว่าน้ำหนักตัวเอง "อยู่ในช่วงที่คาดไว้" หรือไม่ ถ้าแสดงผิด
 * จะทำให้กังวลโดยไม่จำเป็น หรือแย่กว่านั้นคือสบายใจทั้งที่ควรไปหาหมอ
 */
test("การ์ดน้ำหนักชวนให้กรอกข้อมูลที่ขาด แล้วแสดงผลเทียบเกณฑ์เมื่อข้อมูลครบ", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("wcard"), "แม่ดูกราฟ");
  await completeOnboarding(page, "ครอบครัวดูกราฟ");

  await test.step("ยังไม่มีส่วนสูง/น้ำหนัก = ชวนให้ใส่ ไม่ใช่คำนวณมั่ว", async () => {
    await gotoApp(page, "/health");
    await expect(page.getByText("น้ำหนักเทียบเกณฑ์")).toBeVisible();
    await expect(page.getByRole("link", { name: "ใส่ข้อมูล" })).toBeVisible();
  });

  await test.step("ใส่ข้อมูลแล้วยังไม่เคยชั่ง = ชวนให้บันทึก", async () => {
    await page.getByRole("link", { name: "ใส่ข้อมูล" }).click();
    await page.getByLabel("ส่วนสูง (ซม.)").fill("160");
    await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("52");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

    await gotoApp(page, "/health");
    await expect(page.getByText(/บันทึกน้ำหนักสักครั้ง/)).toBeVisible();
    await expect(page.getByText(/11\.5–16 กก\./)).toBeVisible();
  });

  await test.step("บันทึกน้ำหนักแล้วการ์ดเทียบเกณฑ์ให้เห็น", async () => {
    await gotoApp(page, "/health/new");
    await page.getByLabel(/น้ำหนัก/).first().fill("58.4");
    await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
    await page.waitForURL(/\/health(\?|$)/, { timeout: 30_000 });

    // อายุครรภ์ 24 สัปดาห์ (ตั้งค่าโดย completeOnboarding) เพิ่ม 6.4 กก.
    await expect(page.getByText(/เพิ่มมาแล้ว/)).toContainText("6.4");
    await expect(page.getByText(/อยู่ในช่วงที่คาดไว้/)).toBeVisible();
    await expect(page.getByText(/ครรภ์เดี่ยว ไม่ใช่คำวินิจฉัย/)).toBeVisible();
  });

  /**
   * กราฟต้องมีแกนให้อ่านค่าได้ ไม่ใช่เส้นลอยๆ
   *
   * แกนตั้งเป็น**น้ำหนักจริง** ไม่ใช่น้ำหนักที่เพิ่ม — คนชั่งได้ 58.4 ตอนเช้า
   * ต้องหาตัวเองบนกราฟเจอ ไม่ต้องคิดในใจว่า 0 คือน้ำหนักก่อนท้องของตัวเอง
   * เทสต์นี้ปักลำดับป้ายทั้งหมดไว้ เพราะถ้าแกนหายไปเงียบๆ กราฟจะอ่านไม่ออก
   * แล้วไม่มีอะไรฟ้อง
   */
  await test.step("กราฟมีแกนน้ำหนักจริงและแกนสัปดาห์", async () => {
    const chart = page.locator('svg[aria-label^="สัปดาห์ที่"]');
    await expect(chart).toHaveAttribute(
      "aria-label",
      /สัปดาห์ที่ 24 น้ำหนัก 58\.4 กิโลกรัม/,
    );
    // ก่อนท้อง 52 กก. ขีดเกาะทวีคูณของ 4 — เลขกลมๆ ไม่ใช่ 51.5/55.0/58.5
    await expect(chart.locator("text")).toContainText([
      "52",
      "56",
      "60",
      "64",
      "68",
      "กก.",
      "10",
      "20",
      "30",
      "40 สัปดาห์",
    ]);
  });
});

/**
 * Regression — เกินช่วงนิดเดียวต้องไม่ขึ้นคำที่ทำให้ตกใจ
 *
 * ขอบของช่วง IOM ไม่ใช่เส้นตัดสิน ตัวเลขรายสัปดาห์เป็นการคำนวณต่อจากน้ำหนัก
 * รวมทั้งครรภ์กับอัตราต่อสัปดาห์ บวกสมมติฐานไตรมาสแรกที่กว้าง 1.5 กก.
 * ตั้งแต่ต้น คนที่เกินขอบบน 0.3 กก. จึงไม่ควรเห็นข้อความเดียวกับคนที่เกิน 3 กก.
 */
test("เกินช่วงที่คาดไว้นิดเดียว บอกว่าห่างแค่ไหน และบอกที่มาของเกณฑ์ได้", async ({
  page,
}) => {
  await signUp(page, uniqueEmail("wslight"), "แม่เกินนิดเดียว");
  await completeOnboarding(page, "ครอบครัวเกินนิดเดียว");

  await gotoApp(page, "/profile/pregnancy");
  await page.getByLabel("ส่วนสูง (ซม.)").fill("160");
  await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("52");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  // สัปดาห์ 24 ช่วงที่คาดไว้คือ 4.4–7.5 กก. — 59.8 คือเพิ่ม 7.8 เกินขอบบน 0.3
  await gotoApp(page, "/health/new");
  await page.getByLabel(/น้ำหนัก/).first().fill("59.8");
  await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
  await page.waitForURL(/\/health(\?|$)/, { timeout: 30_000 });

  await test.step("บอกเป็นกิโลว่าห่างแค่ไหน ไม่ใช่แค่ว่าอยู่นอกช่วง", async () => {
    await expect(page.getByText(/เกินช่วงที่คาดไว้ 0\.3 กก\./)).toBeVisible();
    await expect(page.getByText(/ห่างไม่ถึงที่ขึ้นได้ใน 1 สัปดาห์/)).toBeVisible();
    // คำเดิมที่ทำให้ตกใจต้องไม่กลับมา
    await expect(page.getByText(/สูงกว่าช่วงที่คาดไว้/)).toHaveCount(0);
  });

  await test.step("กดดูได้ว่าช่วงนี้มาจากเกณฑ์อะไร", async () => {
    const source = page.getByText(/ช่วงที่คาดไว้นี้มาจากไหน/);
    await expect(source).toBeVisible();
    await source.click();
    await expect(page.getByText(/IOM 2009/)).toBeVisible();
    // ต้องบอกด้วยว่าตัวเลขรายสัปดาห์เป็นการคำนวณต่อ ไม่ใช่ตัวเลขที่เกณฑ์ให้มาตรงๆ
    await expect(page.getByText(/ขอบของช่วงจึงไม่ใช่เส้นตัดสิน/)).toBeVisible();
  });
});

/**
 * Regression — ชั่งสองครั้งในสัปดาห์เดียว ต้องตัดสินจากครั้งล่าสุด
 *
 * สัปดาห์เดียวชั่งหลายครั้งเป็นเรื่องปกติ (ชั่งเองที่บ้าน แล้วไปชั่งที่โรงพยาบาล
 * ตอนฝากครรภ์) การ์ดเคยหยิบครั้งที่เก่าที่สุดของสัปดาห์มาตัดสิน เพราะเรียงตาม
 * สัปดาห์แล้วหยิบตัวท้าย ซึ่งไปอาศัยลำดับที่คิวรีส่งมา (ใหม่ไปเก่า) โดยไม่รู้ตัว
 */
test("ชั่งสองครั้งในสัปดาห์เดียว การ์ดต้องใช้ครั้งล่าสุด", async ({ page }) => {
  await signUp(page, uniqueEmail("wtwice"), "แม่ชั่งสองครั้ง");
  await completeOnboarding(page, "ครอบครัวชั่งสองครั้ง");

  await gotoApp(page, "/profile/pregnancy");
  await page.getByLabel("ส่วนสูง (ซม.)").fill("160");
  await page.getByLabel("น้ำหนักก่อนตั้งครรภ์ (กก.)").fill("52");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  // ทั้งสองครั้งอยู่ในสัปดาห์ 24 ต่างกันแค่วันที่ชั่ง
  for (const [date, kg] of [
    [daysAgo(4), "58.4"],
    [daysAgo(0), "59.8"],
  ]) {
    await gotoApp(page, "/health/new");
    await page.getByLabel("วันที่บันทึก").fill(date);
    await page.getByLabel("สัปดาห์ที่").fill("24");
    await page.getByLabel(/น้ำหนัก/).first().fill(kg);
    await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
    await page.waitForURL(/\/health(\?|$)/, { timeout: 30_000 });
  }

  await test.step("ตัวเลขบนการ์ดมาจากครั้งล่าสุด ไม่ใช่ครั้งแรกของสัปดาห์", async () => {
    const chart = page.locator('svg[aria-label^="สัปดาห์ที่"]');
    await expect(chart).toHaveAttribute("aria-label", /น้ำหนัก 59\.8 กิโลกรัม/);
    await expect(page.getByText(/เพิ่มมาแล้ว/)).toContainText("7.8");
    // 6.4 คือค่าของครั้งแรก — โผล่บนการ์ดเมื่อไหร่คือบั๊กเดิมกลับมา
    await expect(page.getByText(/เพิ่มมาแล้ว 6\.4 กก\./)).toHaveCount(0);
  });

  await test.step("บันทึกทั้งสองครั้งยังอยู่ครบในรายการ", async () => {
    await expect(page.getByText("59.8 กก.")).toBeVisible();
    await expect(page.getByText("58.4 กก.")).toBeVisible();
  });
});
