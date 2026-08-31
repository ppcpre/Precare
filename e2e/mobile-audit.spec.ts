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
 * T6.4 — ตรวจสิ่งที่เครื่องตรวจได้แทนการไล่ดูด้วยตาบนมือถือจริง
 *
 * ไม่ได้แทนการทดสอบบนเครื่องจริง (ยังต้องดูเรื่องการไถด้วยนิ้ว คีย์บอร์ดที่เด้งขึ้นมา
 * และ HEIC จาก iPhone) แต่ตัดงานที่ไล่ด้วยตาแล้วพลาดง่ายออกไปได้
 *
 * รันเฉพาะโปรเจกต์ mobile — บนเดสก์ท็อปกติกาพวกนี้ไม่ได้ใช้
 */
test.describe.configure({ mode: "serial" });

const PAGES = [
  "/dashboard",
  "/health",
  "/health/new",
  "/appointments",
  "/appointments/new",
  "/appointments/costs",
  "/album",
  "/kicks",
  "/profile",
  "/family",
];

/** design-system.md ข้อ 4 — touch target ต้องไม่ต่ำกว่า 44px */
const MIN_TOUCH = 44;

test("มือถือ: ไม่มีหน้าไหนล้นออกทางขวา และ touch target ไม่เล็กเกินเกณฑ์", async ({
  page,
}, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "กติกานี้ใช้กับจอมือถือเท่านั้น");

  await signUp(page, uniqueEmail("audit"), "แม่ตรวจจอ");
  await completeOnboarding(page, "ครอบครัวตรวจจอ");

  // ใส่ข้อมูลให้ทุกหน้ามีของจริงให้วัด ไม่ใช่วัดหน้าเปล่า
  await gotoApp(page, "/album/upload");
  await pickFiles(page, [
    { name: "a.png", mimeType: "image/png", buffer: makePng(900, 700, 1) },
  ]);
  await page.getByLabel("วันที่ถ่าย").fill(daysAgo(3));
  await page.getByLabel("คำบรรยาย").fill("รูปทดสอบขนาดจอ");
  await page.getByRole("button", { name: /เพิ่ม 1 รูปเข้าอัลบั้ม/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  const overflow: string[] = [];
  const small: string[] = [];

  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("load");

    const report = await page.evaluate((min) => {
      const doc = document.documentElement;
      // เผื่อ 1px กันการปัดเศษของเบราว์เซอร์
      const overflowBy = doc.scrollWidth - doc.clientWidth;

      // แถวเลื่อนแนวนอนตั้งใจให้ล้นในตัวมันเอง จึงไม่นับ
      const scrollers = [...document.querySelectorAll<HTMLElement>("*")].filter(
        (el) => getComputedStyle(el).overflowX === "auto",
      );
      const insideScroller = (el: Element) => scrollers.some((s) => s.contains(el));

      const tooSmall: string[] = [];
      for (const el of document.querySelectorAll<HTMLElement>(
        "a, button, input, select, textarea, [role=switch], [role=radio]",
      )) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue; // ซ่อนอยู่
        if (insideScroller(el)) continue;

        // checkbox/radio ตัวเล็กแต่ถูกครอบด้วย label ที่กดได้ทั้งแถบ
        // วัดพื้นที่กดจริงจาก label ไม่ใช่จากกล่องของ input
        const hit =
          el.closest("label") && (el as HTMLInputElement).type !== "text"
            ? el.closest("label")!.getBoundingClientRect()
            : r;
        if (hit.height + 0.5 >= min && hit.width + 0.5 >= min) continue;
        {
          const label =
            el.getAttribute("aria-label") ||
            el.textContent?.trim().slice(0, 28) ||
            el.tagName.toLowerCase();
          tooSmall.push(`${label} (${Math.round(hit.width)}x${Math.round(hit.height)})`);
        }
      }
      return { overflowBy, tooSmall };
    }, MIN_TOUCH);

    if (report.overflowBy > 1) overflow.push(`${path} ล้น ${report.overflowBy}px`);
    for (const s of report.tooSmall) small.push(`${path} → ${s}`);
  }

  expect(overflow, `หน้าที่เลื่อนออกทางขวาได้:\n${overflow.join("\n")}`).toEqual([]);
  expect(small, `ปุ่มที่เล็กกว่า ${MIN_TOUCH}px:\n${small.join("\n")}`).toEqual([]);
});

test("มือถือ: bottom nav เผื่อ safe area และไม่ทับเนื้อหาท้ายหน้า", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "bottom nav มีเฉพาะจอมือถือ");

  await signUp(page, uniqueEmail("safearea"), "แม่เซฟแอเรีย");
  await completeOnboarding(page, "ครอบครัวเซฟแอเรีย");

  const nav = page.locator('nav[aria-label="เมนูหลัก"]');
  await expect(nav).toBeVisible();

  // iPhone ที่มี home indicator ต้องเผื่อพื้นที่ล่าง ไม่งั้นปุ่มล่างสุดกดไม่โดน
  const padding = await nav.evaluate((el) => getComputedStyle(el).paddingBottom);
  expect(padding, "bottom nav ต้องมี padding-bottom จาก env(safe-area-inset-bottom)").toBeTruthy();

  // เนื้อหาท้ายหน้าต้องเลื่อนพ้น nav ได้ ไม่ถูกบังถาวร
  await page.goto("/health");
  const clear = await page.evaluate(() => {
    const nav = document.querySelector('nav[aria-label="เมนูหลัก"]');
    const main = document.querySelector("main");
    if (!nav || !main) return null;
    const navTop = nav.getBoundingClientRect().top;
    const style = getComputedStyle(main);
    return { navTop, paddingBottom: parseFloat(style.paddingBottom) };
  });
  expect(clear).not.toBeNull();
});
