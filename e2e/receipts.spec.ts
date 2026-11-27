import { expect, test } from "@playwright/test";
import { completeOnboarding, daysAgo, gotoApp, makePng, signUp, uniqueEmail } from "./helpers";

/**
 * ใบเสร็จของนัด
 *
 * E2E รัน wrangler dev ด้วย --local ซึ่งปิด AI binding — เทสต์นี้จึงเดินทาง
 * "อ่านอัตโนมัติไม่ได้" เสมอ ซึ่งเป็นเส้นทางจริงของ production ด้วย
 * (โควตาฟรีรายวันหมด หรือ AI ล่ม) และเป็นเส้นทางที่ห้ามพังที่สุด:
 * ใบเสร็จต้องแนบได้ และค่าใช้จ่ายต้องกรอกเองได้ แม้ AI ใช้ไม่ได้
 *
 * ความถูกต้องของการอ่านยอดจริงคุมด้วย test/receipt.test.ts (รูปแบบคำขอ + แปลงคำตอบ)
 * และการเรียกโมเดลจริงหนึ่งครั้งตอนพัฒนา ซึ่งบันทึกไว้ใน docs/tech-notes.md
 */
test("แนบใบเสร็จ: อ่านอัตโนมัติไม่ได้ก็ยังแนบได้ และกรอกค่าใช้จ่ายเองได้", async ({ page }) => {
  await signUp(page, uniqueEmail("receipt"), "แม่เก็บใบเสร็จ");
  await completeOnboarding(page, "ครอบครัวเก็บใบเสร็จ");

  await test.step("สร้างนัดที่ผ่านมาแล้ว", async () => {
    await gotoApp(page, "/appointments/new");
    await page.getByLabel("วันที่").fill(daysAgo(3));
    await page.getByLabel("เวลา").fill("09:30");
    await page.getByLabel("หัวข้อนัด").fill("ตรวจครรภ์มีใบเสร็จ");
    await page.getByRole("button", { name: "บันทึกนัดหมาย" }).click();
    await page.waitForURL(/\/appointments(\?|$)/, { timeout: 30_000 });
  });

  await test.step("ปุ่มใบเสร็จต้องเห็นบนการ์ดนัดเลย ไม่ใช่ซ่อนอยู่ในหน้าแก้ไข", async () => {
    // เดิมทางเข้ามีแค่ไอคอนดินสอ แล้วต้องเลื่อนผ่านฟอร์มทั้งหน้า
    // ผู้ใช้ทดสอบบน dev แล้วหาไม่เจอทั้งที่ deploy ขึ้นไปแล้ว
    // goto ธรรมดา — หน้ารายการนัดมีแต่ลิงก์ ไม่มีปุ่มให้รอ hydrate
    await page.goto("/appointments?tab=past");
    const entry = page.getByRole("link", { name: /แนบใบเสร็จ \/ ค่าใช้จ่าย/ });
    await expect(entry).toBeVisible();
    await expect(entry).toContainText("ยังไม่ระบุ");
    await entry.click();
    await page.waitForURL(/\/appointments\/[^/]+\/edit#receipts/, { timeout: 30_000 });
    await expect(page.getByRole("heading", { name: "ใบเสร็จและค่าใช้จ่าย" })).toBeVisible();
    // ต้องพาเลื่อนลงมาถึงส่วนใบเสร็จเลย ไม่ใช่วางไว้บนสุดของฟอร์ม
    await expect(page.getByRole("button", { name: "แนบใบเสร็จ" })).toBeInViewport();
  });

  await test.step("แนบรูปใบเสร็จ — อ่านไม่ได้ต้องบอกตรงๆ ไม่ใช่ค้างเงียบ", async () => {
    const [chooser] = await Promise.all([
      page.waitForEvent("filechooser"),
      page.getByRole("button", { name: "แนบใบเสร็จ" }).click(),
    ]);
    await chooser.setFiles({ name: "receipt.png", mimeType: "image/png", buffer: makePng(800, 1100, 3) });

    await expect(page.getByText(/อ่านใบเสร็จอัตโนมัติไม่ได้/)).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("ใบที่ 1")).toBeVisible();
    await expect(page.getByText("ยังอ่านยอดไม่ได้")).toBeVisible();
    // ไม่มีอะไรถูกเติมลงช่องเอง — ไม่มีตัวเลขมาจากไหนเลย
    await expect(page.getByLabel("ค่าใช้จ่ายของนัดนี้")).toHaveValue("");
  });

  await test.step("กรอกเองแล้วบันทึกได้ และไม่ขึ้นป้ายว่าอ่านจากใบเสร็จ", async () => {
    await page.getByLabel("ค่าใช้จ่ายของนัดนี้").fill("2,550.50");
    await expect(page.getByText(/อ่านจากใบเสร็จอัตโนมัติ/)).toHaveCount(0);
    await page.getByRole("button", { name: "บันทึกค่าใช้จ่าย" }).click();
    await expect(page.getByRole("button", { name: "บันทึกค่าใช้จ่าย" })).toBeDisabled({ timeout: 30_000 });
  });

  await test.step("การ์ดนัดโชว์ยอดที่บันทึกแล้ว", async () => {
    await page.goto("/appointments?tab=past");
    await expect(page.getByRole("link", { name: /ใบเสร็จ \/ ค่าใช้จ่าย/ })).toContainText("฿2,550.50");
  });

  await test.step("ค่าใช้จ่ายไปถึงหน้าสรุปจริง — ใช้ทางเขียนเดียวกับหน้าค่าใช้จ่าย", async () => {
    await gotoApp(page, "/appointments/costs");
    await expect(page.getByLabel(/ค่าใช้จ่าย ตรวจครรภ์มีใบเสร็จ/)).toHaveValue("2,550.50");
  });

  await test.step("ใบเสร็จไม่ขึ้นในอัลบั้ม", async () => {
    // เอกสารที่มีชื่อคนไข้ไม่ควรไปโผล่ข้างรูปอัลตราซาวด์ในอัลบั้มลูก
    await page.goto("/album");
    await expect(page.getByRole("img", { name: /ใบเสร็จ/ })).toHaveCount(0);
    await expect(page.getByText(/ยังไม่มีรูป|ยังไม่มีไฟล์|เพิ่มรูปแรก/).first()).toBeVisible();
  });
});
