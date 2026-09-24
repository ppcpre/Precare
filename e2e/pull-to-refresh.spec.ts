import { expect, test, type Page } from "@playwright/test";
import { completeOnboarding, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — ลากลงเพื่อโหลดหน้าใหม่
 *
 * ท่านี้ต้องเป็น touch event จริง ไม่ใช่ mouse — Playwright มีแค่ tap
 * เลยยิงผ่าน CDP ตรงๆ (page.touchscreen ทำ drag ไม่ได้)
 *
 * ตัวชี้ขาดคือ "หน้าโหลดใหม่จริงไหม" ไม่ใช่ "วงหมุนขึ้นไหม" — เช็คด้วยตัวแปร
 * ที่ฝากไว้บน window ถ้ายังอยู่แปลว่าไม่ได้โหลดใหม่ (router.refresh เฉยๆ ก็ยังอยู่)
 */
test.describe.configure({ mode: "serial" });

// เดสก์ท็อปไม่มีนิ้ว component ไม่ผูก listener เลย — ไม่ใช่เทสต์ที่ข้ามเพราะขี้เกียจ
test.skip(({ isMobile }) => !isMobile, "ท่านี้มีเฉพาะจอสัมผัส");

async function swipeDown(page: Page, from: number, to: number) {
  const cdp = await page.context().newCDPSession(page);
  const x = 200;
  await cdp.send("Input.dispatchTouchEvent", {
    type: "touchStart",
    touchPoints: [{ x, y: from }],
  });
  const steps = 10;
  for (let i = 1; i <= steps; i++) {
    await cdp.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [{ x, y: from + ((to - from) * i) / steps }],
    });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await cdp.detach();
}

const mark = (page: Page) =>
  page.evaluate(() => {
    (window as unknown as { __alive?: number }).__alive = 1;
  });
const alive = (page: Page) =>
  page.evaluate(() => (window as unknown as { __alive?: number }).__alive === 1);

test("ลากลงเพื่อโหลดหน้าใหม่ — และท่าที่ไม่ควรรีเฟรช", async ({ page }) => {
  await signUp(page, uniqueEmail("ptr"), "แม่ลากลง");
  await completeOnboarding(page, "ครอบครัวลากลง");

  await test.step("ลากยาวจากบนสุด = โหลดใหม่ทั้งหน้า", async () => {
    await mark(page);
    expect(await alive(page)).toBe(true);

    // รอ event load ไว้ก่อนลาก — ถ้ารอทีหลัง หน้าอาจโหลดเสร็จไปแล้วและรอค้าง
    const reloaded = page.waitForEvent("load", { timeout: 20_000 });
    // 300px ที่หน่วง 0.5 = ตัวชี้ลง 150 > TRIGGER 72
    await swipeDown(page, 140, 440);
    await reloaded;

    // document ใหม่ = ตัวแปรที่ฝากไว้บน window หายไป
    expect(await alive(page)).toBe(false);
    // โหลดใหม่จริงต้องได้หน้าเดิมกลับมาครบ ไม่ใช่หน้าขาว
    await expect(page.getByText("อายุครรภ์")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("ลากสั้นๆ ไม่ถึงระยะ ไม่โหลดใหม่", async () => {
    await mark(page);
    // 80px ที่หน่วง 0.5 = 40 ยังไม่ถึง TRIGGER
    await swipeDown(page, 140, 220);
    await page.waitForTimeout(1_500);
    expect(await alive(page)).toBe(true);
  });

  await test.step("เลื่อนหน้าลงไปแล้ว ลากลงคือเลื่อนกลับขึ้น ไม่ใช่รีเฟรช", async () => {
    // เลื่อนซ้ำในทุกรอบที่ poll — หน้าที่เพิ่งโหลดใหม่จะดีดกลับบนสุดระหว่าง hydrate
    await expect
      .poll(() =>
        page.evaluate(() => {
          window.scrollTo(0, 400);
          return window.scrollY;
        }),
      )
      .toBeGreaterThan(100);

    await mark(page);
    await swipeDown(page, 140, 440);
    await page.waitForTimeout(1_500);
    expect(await alive(page)).toBe(true);
  });
});
