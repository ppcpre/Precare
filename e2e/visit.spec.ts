import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * สรุปก่อนพบแพทย์
 *
 * ข้อห้ามของฟีเจอร์นี้เหมือนนับลูกดิ้น: ชี้ให้ดู ไม่ใช่วินิจฉัย
 * และห้ามให้ความมั่นใจ — ตัวเลขที่ปกติไม่ได้แปลว่าไม่มีอะไร
 */
const BANNED = ["ปกติดี", "ปลอดภัย", "สบายใจได้", "ไม่ต้องกังวล", "เสี่ยง", "ครรภ์เป็นพิษ"];

test("สรุปให้หมอดู: คัดของผิดปกติขึ้นบน และไม่วินิจฉัย", async ({ page }) => {
  await signUp(page, uniqueEmail("visit"), "แม่เตรียมพบหมอ");
  await completeOnboarding(page, "ครอบครัวเตรียมพบหมอ");

  await test.step("ยังไม่มีข้อมูล ต้องบอกให้ไปบันทึก ไม่ใช่โชว์การ์ดที่มีแต่ขีด", async () => {
    // goto ธรรมดา — หน้าสรุปทั้งหน้าเป็นลิงก์กับข้อความล้วน ไม่มีปุ่มให้กด
    // จึงไม่มี client component ให้รอ hydrate (ตั้งใจให้เป็นแบบนั้น
    // หน้านี้ถูกยื่นให้หมอดู ไม่ใช่หน้าที่ต้องกดอะไร)
    await page.goto("/visit");
    await expect(page.getByText("ยังไม่มีข้อมูลให้สรุป")).toBeVisible();
  });

  await test.step("บันทึกความดันที่สูงกว่าเกณฑ์", async () => {
    await gotoApp(page, "/health/new");
    await page.getByLabel(/น้ำหนัก/).fill("64.8");
    await page.getByLabel(/ตัวบน/).fill("148");
    await page.getByLabel(/ตัวล่าง/).fill("92");
    await page.getByRole("button", { name: /บันทึก/ }).click();
    await page.waitForURL(/\/health$/, { timeout: 30_000 });
  });

  await test.step("ความดันต้องถูกคัดขึ้นเป็นสิ่งที่ควรบอกหมอ", async () => {
    await page.goto("/visit");
    await expect(page.getByText("สิ่งที่ควรบอกหมอ")).toBeVisible();
    await expect(page.getByText(/148\/92/).first()).toBeVisible();

    const text = await page.locator("main").innerText();
    for (const word of BANNED) {
      expect(text, `หน้านี้ห้ามมีคำว่า "${word}"`).not.toContain(word);
    }
  });

  await test.step("จดคำถาม ติ๊กว่าถามแล้ว แล้วยังอยู่ในรายการ", async () => {
    await gotoApp(page, "/visit/questions");
    await page.getByLabel("คำถามใหม่").fill("บวมที่เท้าตอนเย็นปกติไหม");
    await page.getByRole("button", { name: /เพิ่ม/ }).click();
    await expect(page.getByText("บวมที่เท้าตอนเย็นปกติไหม")).toBeVisible();
    await expect(page.getByText("ยังไม่ได้ถาม · 1 ข้อ")).toBeVisible();

    // ปุ่มติ๊กกับปุ่มลบเป็นของที่กดตอนอยู่ในห้องตรวจ กดพลาดแล้วต้องมานั่งแก้
    // กล่องที่เห็นเล็กได้ แต่พื้นที่แตะต้องไม่ต่ำกว่าเกณฑ์ของ design-system
    // ปุ่มติ๊กประกาศ role="checkbox" ไว้ จึงไม่ match กับ role button
    const controls = [
      page.getByRole("checkbox", { name: /ถามแล้ว/ }).first(),
      page.getByRole("button", { name: /ลบคำถาม/ }).first(),
    ];
    for (const c of controls) {
      const box = await c.boundingBox();
      expect(box!.width, "พื้นที่แตะกว้างต่ำกว่า 44px").toBeGreaterThanOrEqual(44);
      expect(box!.height, "พื้นที่แตะสูงต่ำกว่า 44px").toBeGreaterThanOrEqual(44);
    }

    // ติ๊กแล้วต้องย้ายกลุ่ม ไม่ใช่หายไป — คำถามเดิมมักถูกถามซ้ำนัดหน้า
    await page.getByRole("checkbox", { name: /ถามแล้ว/ }).click();
    await expect(page.getByText("ถามแล้ว · 1 ข้อ")).toBeVisible();
    await expect(page.getByText("บวมที่เท้าตอนเย็นปกติไหม")).toBeVisible();
  });

  await test.step("จำนวนคำถามที่ค้างต้องโผล่บนทางเข้าที่หน้าแรก", async () => {
    await gotoApp(page, "/visit/questions");
    await page.getByLabel("คำถามใหม่").fill("ต้องเตรียมอะไรบ้างตอนคลอด");
    await page.getByRole("button", { name: /เพิ่ม/ }).click();
    await expect(page.getByText("ยังไม่ได้ถาม · 1 ข้อ")).toBeVisible();

    // ครอบครัวนี้ยังไม่ได้ตั้งอายุครรภ์ หน้าแรกจึงยังไม่มีปุ่มนับลูกดิ้น
    // และไม่มีปุ่มอื่นเลย ใช้ goto ธรรมดาเหมือนหน้าสรุป
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: /สรุปให้หมอดู/ })).toBeVisible();
  });
});
