import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — หน้าอาการที่ต้องไปโรงพยาบาล
 *
 * หน้านี้มีไว้ให้คนเปิดตอนตกใจ ความล้มเหลวของมันไม่มีใครรายงานเป็นบั๊ก —
 * คนแค่หาไม่เจอแล้วไม่ได้ไปโรงพยาบาล เทสต์จึงเน้นสองอย่าง:
 * กดถึงได้จริงจากทุกหน้า และเบอร์กดโทรได้จริง
 */
test("กดถึงได้จากแถบบนทุกหน้า และเบอร์ฉุกเฉินกดโทรได้", async ({ page }) => {
  await signUp(page, uniqueEmail("danger"), "แม่ฉุกเฉิน");
  await completeOnboarding(page, "ครอบครัวฉุกเฉิน");

  await test.step("ไอคอนอยู่ทุกหน้า กดครั้งเดียวถึง", async () => {
    for (const path of ["/dashboard", "/health", "/appointments"]) {
      await gotoApp(page, path);
      await page
        .getByRole("link", { name: "อาการที่ต้องไปโรงพยาบาล" })
        .first()
        .click();
      await page.waitForURL(/\/danger$/, { timeout: 30_000 });
    }
  });

  await test.step("หน้าแรกมีปุ่ม 1669 ที่กดโทรได้ และสามหมวด", async () => {
    const ems = page.getByRole("link", { name: /โทร 1669/ }).first();
    await expect(ems).toHaveAttribute("href", "tel:1669");

    for (const name of ["คนท้อง หลังคลอด", "ผู้สูงอายุ", "เด็กเล็ก"]) {
      await expect(page.getByRole("link", { name: new RegExp(name) })).toBeVisible();
    }
  });

  await test.step("หมวดผู้สูงอายุมีสโตรคครบ และบอกให้จดเวลา", async () => {
    await page.getByRole("link", { name: /ผู้สูงอายุ/ }).click();
    await page.waitForURL(/\/danger\/elderly$/, { timeout: 30_000 });

    await expect(page.getByText("ปากเบี้ยว ยิ้มแล้วมุมปากตก")).toBeVisible();
    await expect(page.getByText(/จดเวลาที่เริ่มมีอาการ/)).toBeVisible();
    // ข้อที่ผู้หญิงมาด้วยอาการต่างจากผู้ชาย ห้ามหาย
    await expect(page.getByText(/ผู้หญิงมักไม่เจ็บหน้าอกชัด/)).toBeVisible();
    // หมวดหกล้มยังไม่มีแหล่งอ้างอิง ต้องยังไม่โผล่
    await expect(page.getByText("หกล้ม")).toHaveCount(0);
  });

  await test.step("หมวดเด็กเล็กแยกสองช่วงอายุ และเขียนว่าอกบุ๋มลึก", async () => {
    await gotoApp(page, "/danger/child");
    await expect(page.getByText("แรกเกิด – 2 เดือน")).toBeVisible();
    await expect(page.getByText("2 เดือน – 5 ขวบ")).toBeVisible();
    await expect(page.getByText("หายใจเร็ว อกบุ๋มลึก")).toBeVisible();
  });

  await test.step("หมวดคนท้องกดขยายดูรายละเอียดได้", async () => {
    await gotoApp(page, "/danger/pregnancy");
    const row = page.getByRole("button", { name: /เลือดออกทางช่องคลอด/ });
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await row.click();
    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText("ตกขาวมีกลิ่นเหม็น")).toBeVisible();
  });

  await test.step("ข้อสุขภาพจิตมีเบอร์ของตัวเอง ไม่ปนกับ 1669", async () => {
    await expect(page.getByRole("link", { name: /โทร 1323/ })).toHaveAttribute(
      "href",
      "tel:1323",
    );
  });
});

/**
 * เบอร์โรงพยาบาล — ช่องว่างตรงนี้คือสิ่งที่ควรเติมก่อนจะต้องใช้จริง
 * ถ้าซ่อนปุ่มทิ้งตอนยังไม่กรอก จะไม่มีใครรู้ว่าทำได้
 */
test("ยังไม่กรอกเบอร์ รพ. ต้องชวนให้กรอก แล้วพอกรอกแล้วกดโทรได้", async ({ page }) => {
  await signUp(page, uniqueEmail("hosp"), "แม่เบอร์ รพ.");
  await completeOnboarding(page, "ครอบครัวเบอร์ รพ.");

  await gotoApp(page, "/danger/pregnancy");
  const prompt = page.getByRole("link", { name: /ใส่เบอร์ รพ/ });
  await expect(prompt).toBeVisible();
  await prompt.click();
  await page.waitForURL(/\/profile\/pregnancy$/, { timeout: 30_000 });

  await page.getByLabel("โรงพยาบาลที่ฝากครรภ์").fill("รพ.รามาธิบดี");
  // เบอร์ที่มีขีดและคำว่า "ต่อ" ต้องผ่าน — บังคับรูปแบบแล้วคนจะเลิกกรอก
  await page.getByLabel("เบอร์โทรโรงพยาบาล").fill("02-201-1000 ต่อ 2345");
  await page.getByRole("button", { name: "บันทึก", exact: true }).first().click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });

  await gotoApp(page, "/danger/pregnancy");
  const call = page.getByRole("link", { name: /โทร รพ\. ที่ฝากครรภ์/ });
  await expect(call).toBeVisible();
  await expect(call).toContainText("รพ.รามาธิบดี");
  await expect(call).toHaveAttribute("href", "tel:02-201-1000ต่อ2345");
});

/**
 * หลังคลอดเห็นอาการคนละชุด — CDC ระบุว่ารายการใช้ถึง 1 ปีหลังคลอด
 * แต่ "ลูกดิ้นน้อยลง" ไม่เกี่ยวแล้ว ส่วน "เลือดชุ่มผ้าอนามัย" เพิ่งเกี่ยว
 */
test("หลังคลอดเห็นอาการของหลังคลอด ไม่ใช่ของตอนท้อง", async ({ page }) => {
  await signUp(page, uniqueEmail("ppdanger"), "แม่หลังคลอด");
  await completeOnboarding(page, "ครอบครัวหลังคลอด");

  await gotoApp(page, "/danger/pregnancy");
  await expect(page.getByRole("button", { name: /ลูกดิ้นน้อยลง/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /เลือดออกมากหลังคลอด/ })).toHaveCount(0);

  await gotoApp(page, "/profile/pregnancy");
  await page.getByRole("button", { name: "บันทึกว่าคลอดแล้ว" }).click();
  await page.getByRole("button", { name: "ยืนยัน" }).click();
  await expect(page.getByText("สถานะ: คลอดแล้ว")).toBeVisible({ timeout: 30_000 });

  await gotoApp(page, "/danger/pregnancy");
  await expect(page.getByRole("button", { name: /เลือดออกมากหลังคลอด/ })).toBeVisible();
  await expect(page.getByRole("button", { name: /ลูกดิ้นน้อยลง/ })).toHaveCount(0);
});
