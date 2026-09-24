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
  "/labor",
  "/visit",
  "/visit/questions",
  "/profile",
  "/profile/privacy",
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
  await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  const overflow: string[] = [];
  const small: string[] = [];

  for (const path of PAGES) {
    await page.goto(path);
    await page.waitForLoadState("load");

    /**
     * ต้องยืนยันว่าอยู่หน้าที่ตั้งใจจะวัดจริง
     *
     * ถ้าโดน redirect ไป /login หรือ /onboarding (เกิดได้ตอน wrangler dev ป่วย)
     * ลูปนี้จะวัดหน้าอื่นแล้วผ่านฉลุยโดยไม่มีใครรู้ว่าไม่ได้วัดอะไรเลย
     * เคยเป็นแบบนั้นมาแล้ว — เทสต์เขียวในเครื่อง แต่ CI จับบั๊กปุ่มเล็กได้
     */
    expect(new URL(page.url()).pathname, `${path} ถูก redirect ไปหน้าอื่น`).toBe(path);

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

  /**
   * จำลองเครื่องที่มีแถบลากด้านล่าง (iPhone ราว 34px)
   *
   * Chromium ในเทสต์ไม่มีขอบจอ env(safe-area-inset-bottom) จึงเป็น 0 เสมอ
   * บั๊กที่ไอคอนเมนูถูกบีบบนเครื่องจริงจะไม่มีวันถูกจับได้ถ้าไม่กำหนดค่าเอง
   * (เคยเกิดจริง: nav ตั้ง h-16 แล้วใส่ padding ไว้ข้างใน พื้นที่ไอคอนเหลือ 30px)
   */
  const INSET = 34;
  await page.addStyleTag({ content: `:root { --safe-b: ${INSET}px; }` });

  const box = await nav.evaluate((el) => {
    const cs = getComputedStyle(el);
    const item = el.querySelector("a");
    return {
      height: el.getBoundingClientRect().height,
      paddingBottom: parseFloat(cs.paddingBottom),
      itemHeight: item ? item.getBoundingClientRect().height : 0,
    };
  });

  expect(box.paddingBottom, "ต้องเผื่อขอบจอด้านล่าง").toBe(INSET);
  // พื้นที่ของไอคอน = ความสูงทั้งหมด ลบส่วนที่เผื่อไว้ให้ขอบจอ
  const content = box.height - box.paddingBottom;
  expect(content, "พื้นที่ไอคอนต้องไม่ถูกขอบจอกินไป").toBeGreaterThanOrEqual(64);
  expect(box.itemHeight, "ไอคอนกับป้ายต้องอยู่ครบในพื้นที่").toBeLessThanOrEqual(content + 0.5);

  // เนื้อหาท้ายหน้าต้องเว้นให้พ้นแถบที่สูงขึ้นตามขอบจอด้วย
  await page.goto("/health");
  await page.addStyleTag({ content: `:root { --safe-b: ${INSET}px; }` });
  const mainPad = await page.evaluate(
    () => parseFloat(getComputedStyle(document.querySelector("main")!).paddingBottom),
  );
  expect(mainPad, "ท้ายหน้าต้องเว้นเท่าความสูงจริงของแถบเมนู").toBeGreaterThanOrEqual(64 + INSET);

});
