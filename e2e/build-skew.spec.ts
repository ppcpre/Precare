import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — แอปที่เปิดค้างไว้ต้องรู้ตัวเมื่อเซิร์ฟเวอร์เปลี่ยนบิลด์
 *
 * แอปที่ติดไว้หน้าจอโฮมเปิดค้างได้เป็นวันโดยไม่โหลดหน้าใหม่ พอ deploy บิลด์ใหม่
 * ปุ่มที่กดจะยิงไปหา Server Action รหัสเก่าที่เซิร์ฟเวอร์ไม่มีแล้ว แล้วขึ้น
 * "An unexpected response was received from the server." ซึ่งผู้ใช้ทำอะไรต่อไม่ถูก
 * (เจอจริงตอนอัปโหลดรูป 14 ต.ค. 69 — log ฝั่งเราไม่เห็นอะไรเลยเพราะคำขอ
 * ไม่เคยถึงโค้ดของเรา)
 */
test.describe.configure({ mode: "serial" });

test("เซิร์ฟเวอร์เปลี่ยนบิลด์แล้ว แอปที่เปิดค้างต้องโหลดใหม่เอง", async ({ page }) => {
  await signUp(page, uniqueEmail("skew"), "แม่เปิดค้าง");
  await completeOnboarding(page, "ครอบครัวเปิดค้าง");

  await test.step("/api/version บอกรหัสบิลด์จริง และห้าม cache", async () => {
    const res = await page.request.get("/api/version");
    expect(res.status()).toBe(200);
    expect(res.headers()["cache-control"]).toContain("no-store");
    const { id } = (await res.json()) as { id: string };
    expect(id).toBeTruthy();
    expect(id).not.toBe("unknown");
  });

  await test.step("รหัสตรงกัน ต้องไม่โหลดใหม่", async () => {
    await gotoApp(page, "/album");
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__kept = true));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(500);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__kept)).toBe(
      true,
    );
  });

  await test.step("รหัสไม่ตรง = โหลดหน้าใหม่เองโดยไม่ต้องให้ผู้ใช้ทำอะไร", async () => {
    await page.route("**/api/version", (route) =>
      route.fulfill({ json: { id: "ไม่ใช่บิลด์นี้แน่ๆ" } }),
    );
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForFunction(
      () => (window as unknown as Record<string, unknown>).__kept === undefined,
      undefined,
      { timeout: 15_000 },
    );
  });

  await test.step("โหลดใหม่แล้วรหัสยังไม่ตรง ต้องไม่วนรีโหลดไม่รู้จบ", async () => {
    await page.evaluate(() => ((window as unknown as Record<string, unknown>).__kept2 = true));
    await page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")));
    await page.waitForTimeout(1500);
    expect(await page.evaluate(() => (window as unknown as Record<string, unknown>).__kept2)).toBe(
      true,
    );
  });
});
