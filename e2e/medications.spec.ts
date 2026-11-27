import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, inviteMember, signUp, uniqueEmail } from "./helpers";

/**
 * Regression — ยาและวิตามิน
 *
 * ของที่ผิดแล้วคนลืมกินยาจริงๆ ไม่ใช่แค่หน้าจอไม่สวย เทสต์จึงเช็คว่า
 * ตั้งแล้วโผล่ในรายการของวันนี้จริง ติ๊กแล้วจำได้ และเป็นของใครของมัน
 */
test.describe.configure({ mode: "serial" });

test("ตั้งยา ติ๊กว่ากินแล้ว และเป็นของใครของมัน", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("meds"), "แม่กินวิตามิน");
  await completeOnboarding(page, "ครอบครัวกินวิตามิน");

  await test.step("เข้าหน้ายาได้จากไอคอนในหน้านัดหมาย", async () => {
    await gotoApp(page, "/appointments");
    await page.getByRole("link", { name: "ยาและวิตามิน" }).click();
    await expect(page).toHaveURL(/\/medications$/);
    await expect(page.getByText("ยังไม่มีรายการของวันนี้")).toBeVisible();
  });

  await test.step("เพิ่มยาที่กินสองเวลา", async () => {
    await page.getByRole("button", { name: "เพิ่มรายการ" }).first().click();
    await page.getByLabel("ชื่อยา/วิตามิน").fill("โฟลิก");
    await page.getByLabel("ปริมาณ").fill("1 เม็ด");
    await page.getByLabel("เวลาครั้งที่ 1", { exact: true }).fill("08:00");
    await page.getByRole("button", { name: "เพิ่มเวลา" }).click();
    await page.getByLabel("เวลาครั้งที่ 2", { exact: true }).fill("20:00");
    await page.getByRole("button", { name: "เพิ่มรายการ" }).last().click();

    // ยาเม็ดเดียวสองเวลา = สองแถวในรายการของวันนี้ เพราะติ๊กแยกกัน
    await expect(page.getByText("กินแล้ว 0 จาก 2")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("ติ๊กว่ากินแล้ว ยอดต้องขยับ และจำได้หลังโหลดใหม่", async () => {
    await page.getByRole("button", { name: "กิน โฟลิก 08:00 แล้ว" }).click();
    await expect(page.getByText("กินแล้ว 1 จาก 2")).toBeVisible({ timeout: 30_000 });

    await page.reload();
    await expect(page.getByText("กินแล้ว 1 จาก 2")).toBeVisible();
    await expect(page.getByRole("button", { name: /ยกเลิกว่ากิน โฟลิก 08:00/ })).toBeVisible();
  });

  await test.step("หยุดเตือนแล้วหายจากรายการของวันนี้ แต่ยังอยู่ในรายการที่ตั้งไว้", async () => {
    await page.getByRole("button", { name: "หยุดเตือน โฟลิก" }).click();
    await expect(page.getByText("ยังไม่มีรายการของวันนี้")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByText("หยุดไว้")).toBeVisible();

    await page.getByRole("button", { name: "เปิดเตือน โฟลิก" }).click();
    await expect(page.getByText("กินแล้ว 1 จาก 2")).toBeVisible({ timeout: 30_000 });
  });

  await test.step("คนอื่นในครอบครัวไม่เห็นยาของเราในรายการของเขา", async () => {
    const member = await inviteMember(page, browser, uniqueEmail("medsmate"), "พ่อไม่กินยา");
    await gotoApp(member.page, "/medications");
    await expect(member.page.getByText("ยังไม่มีรายการของวันนี้")).toBeVisible();
    await expect(member.page.getByText("โฟลิก")).toHaveCount(0);
    await member.ctx.close();
  });
});
