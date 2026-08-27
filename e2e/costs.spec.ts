import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, daysAhead, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * ค่าใช้จ่ายนัดหมาย
 *
 * เน้นสองอย่างที่พังแล้วเงียบที่สุด
 * - null (ยังไม่ระบุ) กับ 0 (ไปแล้วไม่เสียเงิน) ต้องไม่ปนกัน
 * - ยอดรวมต้องบอกเสมอว่าเหลือกี่นัดที่ยังไม่ระบุ
 */
test.describe.configure({ mode: "serial" });

async function addAppointment(
  page: import("@playwright/test").Page,
  opts: { date: string; time: string; title: string; group?: string },
) {
  await gotoApp(page, "/appointments/new");
  await page.getByLabel("วันที่").fill(opts.date);
  await page.getByLabel("เวลา").fill(opts.time);
  await page.getByLabel("หัวข้อนัด").fill(opts.title);
  if (opts.group) await page.getByRole("button", { name: opts.group }).click();
  await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
  // นัดย้อนหลังถูกพาไปแท็บ ผ่านมาแล้ว จึงมี query string ต่อท้าย
  await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });
}

test("กรอกค่าใช้จ่าย แยกกลุ่ม และดูสรุปได้ครบ", async ({ page }) => {
  await signUp(page, uniqueEmail("cost"), "แม่ค่าใช้จ่าย");
  await completeOnboarding(page, "ครอบครัวค่าใช้จ่าย");

  await test.step("กลุ่มฝากครรภ์ต้องถูกสร้างให้อัตโนมัติตอน onboarding", async () => {
    await gotoApp(page, "/appointments/new");
    await expect(page.getByRole("button", { name: "ฝากครรภ์" })).toBeVisible();
  });

  await addAppointment(page, {
    date: daysAgo(30), time: "09:30", title: "ตรวจครรภ์", group: "ฝากครรภ์",
  });

  await test.step("สร้างกลุ่มใหม่จากในฟอร์มได้เลย", async () => {
    await gotoApp(page, "/appointments/new");
    await page.getByLabel("วันที่").fill(daysAgo(10));
    await page.getByLabel("เวลา").fill("14:00");
    await page.getByLabel("หัวข้อนัด").fill("ขูดหินปูน");
    await page.getByRole("button", { name: "กลุ่มใหม่" }).click();
    await page.getByLabel("ชื่อกลุ่มใหม่").fill("ทันตกรรม");
    await page.getByRole("button", { name: "เพิ่ม", exact: true }).click();
    await expect(page.getByRole("button", { name: "ทันตกรรม" })).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
    await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });
  });

  await addAppointment(page, {
    date: daysAhead(14), time: "09:30", title: "ตรวจครรภ์ครั้งหน้า", group: "ฝากครรภ์",
  });

  await test.step("แถบทางเข้าโชว์ว่ายังไม่ได้ระบุครบ", async () => {
    await expect(page.getByRole("link", { name: /ยังไม่ได้ระบุ 3 นัด/ })).toBeVisible();
  });

  await test.step("กรอกค่าใช้จ่าย รวมทั้ง 0 บาท", async () => {
    await page.getByRole("link", { name: /ค่าใช้จ่ายทั้งหมด/ }).click();
    await page.waitForURL(/\/appointments\/costs/, { timeout: 30_000 });

    await page.getByLabel("ค่าใช้จ่าย ตรวจครรภ์", { exact: true }).fill("1,200");
    await page.getByLabel("ค่าใช้จ่าย ขูดหินปูน").fill("1500");
    // 0 = ไปมาแล้วไม่เสียเงิน ต้องบันทึกได้และถูกนับว่าระบุแล้ว
    await page.getByLabel("ค่าใช้จ่าย ตรวจครรภ์ครั้งหน้า").fill("0");

    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    // 0 ต้องถูกนับว่าระบุแล้ว ไม่งั้นจะค้างที่ 2 จาก 3
    await expect(page.getByText("3 จาก 3 นัดระบุแล้ว")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("ยอดรวมถูกต้อง และไม่มีคำเตือนค้างอยู่", async () => {
    await expect(page.getByText("฿2,700").first()).toBeVisible();
    // เฉลี่ย 2,700/3 = 900 — ถ้า 0 ไม่ถูกนับจะได้ 1,350
    await expect(page.getByText("฿900")).toBeVisible();
    await expect(page.getByText(/ยังไม่ได้ระบุอีก/)).toHaveCount(0);
  });

  await test.step("กลับไปหน้านัดหมาย แถบต้องบอกว่าระบุครบแล้ว", async () => {
    await page.getByRole("link", { name: "ปิด" }).click();
    await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });
    await expect(page.getByRole("link", { name: /^ค่าใช้จ่ายทั้งหมด ฿2,700$/ })).toBeVisible();
    await page.getByRole("link", { name: /ค่าใช้จ่ายทั้งหมด/ }).click();
    await page.waitForURL(/\/appointments\/costs/, { timeout: 30_000 });
  });

  await test.step("มุมมองรายกลุ่มแยกยอดถูกต้อง", async () => {
    await page.getByRole("link", { name: "รายกลุ่ม" }).click();
    await expect(page.getByText("รวมทุกกลุ่ม")).toBeVisible();
    // ทันตกรรม 1,500 · ฝากครรภ์ 1,200 (1,200 + 0)
    await expect(page.getByText("฿1,500").first()).toBeVisible();
    await expect(page.getByText("฿1,200").first()).toBeVisible();
    // ยอดมากมาก่อน ทันตกรรมจึงต้องอยู่เหนือฝากครรภ์
    const names = await page.locator("main").innerText();
    expect(names.indexOf("ทันตกรรม")).toBeLessThan(names.lastIndexOf("ฝากครรภ์"));
  });

  await test.step("มุมมองรายเดือนดูทีละเดือน มีปุ่มข้ามเดือน", async () => {
    await page.getByRole("link", { name: "รายเดือน" }).click();
    await expect(page.getByRole("link", { name: "เดือนก่อนหน้า" })).toBeVisible();
  });

  await test.step("กรองเฉพาะกลุ่มทันตกรรม", async () => {
    await page.getByRole("link", { name: "รายนัด" }).click();
    await page.getByRole("link", { name: "ทันตกรรม" }).click();
    await expect(page.getByText("1 จาก 1 นัดระบุแล้ว")).toBeVisible();
    await expect(page.getByText("ตรวจครรภ์", { exact: true })).toHaveCount(0);
  });

  await test.step("ล้างค่ากลับเป็นยังไม่ระบุได้ ไม่ใช่กลายเป็น 0", async () => {
    await page.getByLabel("ค่าใช้จ่าย ขูดหินปูน").fill("");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("0 จาก 1 นัดระบุแล้ว")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText(/ยังไม่ได้ระบุอีก/)).toBeVisible();
  });
});

test("ยังไม่มีนัดหมาย ต้องขึ้นสถานะว่าง ไม่ใช่ ฿0 ลอยๆ", async ({ page }) => {
  await signUp(page, uniqueEmail("costempty"), "แม่ยังไม่มีนัด");
  await completeOnboarding(page, "ครอบครัวยังไม่มีนัด");

  // goto ธรรมดา หน้าว่างไม่มี client component ให้รอ hydrate
  await page.goto("/appointments/costs");
  await expect(page.getByText("ยังไม่มีนัดหมายให้ระบุค่าใช้จ่าย")).toBeVisible();
  // ฿0 อ่านได้ว่าใช้ไปศูนย์บาท ซึ่งคนละเรื่องกับยังไม่มีอะไรให้กรอก
  await expect(page.getByText("฿0")).toHaveCount(0);

  // แถบทางเข้าก็ต้องไม่โผล่บนหน้านัดหมายที่ยังว่าง
  await page.goto("/appointments");
  await expect(page.getByRole("link", { name: /ค่าใช้จ่ายทั้งหมด/ })).toHaveCount(0);
});

/**
 * นัดย้อนหลัง — เดิม input มี min เป็นวันนี้ จึงเลือกวันที่ผ่านมาแล้วไม่ได้
 * ทั้งที่คนส่วนใหญ่เพิ่งมาเริ่มใช้แอปตอนฝากครรภ์ไปหลายครั้งแล้ว
 */
test("บันทึกนัดย้อนหลังได้ และไม่โชว์การแจ้งเตือนที่ไม่มีวันทำงาน", async ({ page }) => {
  await signUp(page, uniqueEmail("past"), "แม่ย้อนหลัง");
  await completeOnboarding(page, "ครอบครัวย้อนหลัง");

  await gotoApp(page, "/appointments/new");
  await page.getByLabel("วันที่").fill(daysAgo(45));
  await page.getByLabel("เวลา").fill("10:00");
  await page.getByLabel("หัวข้อนัด").fill("ฝากครรภ์ครั้งแรก");

  await test.step("เลือกวันย้อนหลังแล้วการ์ดแจ้งเตือนต้องหายไป", async () => {
    await expect(page.getByText(/บันทึกไว้เก็บค่าใช้จ่ายย้อนหลังได้/)).toBeVisible();
    await expect(page.getByRole("switch", { name: "เปิดการแจ้งเตือน" })).toHaveCount(0);
  });

  await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();

  await test.step("พาไปแท็บที่นัดนั้นอยู่จริง ไม่ใช่แท็บกำลังจะถึงที่ไม่เห็นอะไร", async () => {
    await page.waitForURL(/tab=past/, { timeout: 30_000 });
    await expect(page.getByText("ฝากครรภ์ครั้งแรก")).toBeVisible();
  });

  await test.step("แล้วกรอกค่าใช้จ่ายย้อนหลังได้", async () => {
    await page.getByRole("link", { name: /ค่าใช้จ่ายทั้งหมด/ }).click();
    await page.waitForURL(/\/appointments\/costs/, { timeout: 30_000 });
    await page.getByLabel("ค่าใช้จ่าย ฝากครรภ์ครั้งแรก").fill("2800");
    await page.getByRole("button", { name: "บันทึก", exact: true }).click();
    await expect(page.getByText("1 จาก 1 นัดระบุแล้ว")).toBeVisible({ timeout: 30_000 });
  });
});
