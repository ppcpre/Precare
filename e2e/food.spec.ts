import { expect, test } from "@playwright/test";
import {
  completeOnboarding,
  daysAgo,
  gotoApp,
  inviteMember,
  signUp,
  uniqueEmail,
} from "./helpers";

/**
 * Regression — บันทึกอาหารและนับรวมทั้งวัน
 *
 * ยอดรวมคือสิ่งเดียวที่คนดูจริงบนหน้านี้ ถ้าบวกผิดหรือไม่อัปเดตหลังเพิ่ม/ลบ
 * ฟีเจอร์ทั้งหมดก็ไม่มีความหมาย — เทสต์จึงเช็คยอดรวม ไม่ใช่แค่ว่ารายการขึ้น
 *
 * AI ไม่ถูกเรียกในเทสต์นี้ (wrangler dev --local ปิด binding ที่เป็น remote)
 * ซึ่งตรงกับเส้นทางจริงตอนโควตาหมด — ต้องกรอกเองแล้วบันทึกได้ตามปกติ
 */
test.describe.configure({ mode: "serial" });

async function addFood(page: import("@playwright/test").Page, name: string, nums: number[]) {
  await page.getByLabel("ชื่อเมนู").fill(name);
  const labels = ["พลังงาน", "คาร์บ", "น้ำตาล", "โปรตีน"];
  for (const [i, label] of labels.entries()) {
    await page.getByLabel(label, { exact: true }).fill(String(nums[i]));
  }
  await page.getByRole("button", { name: "บันทึกเมนู" }).click();
}

test("เพิ่มเมนูแล้วยอดรวมทั้งวันขยับ และลบแล้วลดลงตาม", async ({ page }) => {
  await signUp(page, uniqueEmail("food"), "แม่นับแคล");
  await completeOnboarding(page, "ครอบครัวนับแคล");

  await test.step("เมนู นับแคล อยู่ในแถบล่าง แทนที่โปรไฟล์", async () => {
    // เมนูล่าง (มือถือ) กับ sidebar (จอกว้าง) เรนเดอร์พร้อมกันทั้งคู่ แล้วซ่อน
    // อีกอันด้วย CSS — และคนละ element คนละ role (nav กับ aside) จึงยึดที่
    // aria-label ตัวที่มองเห็นอยู่ เทสต์เดียวใช้ได้ทั้งสองขนาดจอ
    const nav = page.locator('[aria-label="เมนูหลัก"]:visible');
    await expect(nav.getByRole("link", { name: "นับแคล" })).toBeVisible();
    await expect(nav.getByRole("link", { name: "โปรไฟล์", exact: true })).toHaveCount(0);
    // โปรไฟล์ต้องยังเข้าได้จากรูปมุมขวาบน ไม่งั้นตั้งค่าอะไรไม่ได้เลย
    await expect(page.getByRole("link", { name: /^โปรไฟล์ของ/ })).toBeVisible();
  });

  await gotoApp(page, "/food");

  await test.step("ยังไม่มีอะไร ยอดรวมเป็นศูนย์", async () => {
    await expect(page.getByText("ยังไม่ได้บันทึกอะไรวันนี้")).toBeVisible();
  });

  await test.step("เพิ่มสองเมนู ยอดรวมต้องเป็นผลบวกของทั้งคู่", async () => {
    await addFood(page, "ข้าวมันไก่", [590, 72, 6, 28]);
    // ชื่อเมนูโผล่สองที่: ในรายการของวัน และในชิป "เคยกิน" ที่เพิ่งมี
    await expect(page.getByText("ข้าวมันไก่").first()).toBeVisible({ timeout: 30_000 });

    await addFood(page, "ชาเย็น", [180, 34, 31, 3]);
    await expect(page.getByText("ชาเย็น").first()).toBeVisible({ timeout: 30_000 });

    await expect(page.getByTestId("food-totals")).toContainText("770");
  });

  /**
   * แก้ตัวเลขทีหลังต้องได้ — เลขที่ AI ประมาณให้ผิดได้ และคนมักรู้หลังกดบันทึกแล้ว
   * ถ้าแก้ไม่ได้ ทางเดียวคือลบแล้วพิมพ์ใหม่ ซึ่งคนจะปล่อยเลขผิดไว้แล้วยอดรวมผิดตลอด
   */
  await test.step("แก้ตัวเลขของรายการที่บันทึกแล้ว ยอดรวมต้องเปลี่ยนตาม", async () => {
    await page.getByRole("button", { name: "แก้ตัวเลขของ ชาเย็น" }).click();
    await page.getByLabel("พลังงาน ของ ชาเย็น").fill("120");
    await page.getByRole("button", { name: "บันทึกตัวเลขใหม่" }).click();
    // 590 + 120 = 710 (เดิม 770)
    await expect(page.getByTestId("food-totals")).toContainText("710", { timeout: 30_000 });
  });

  await test.step("ลบรายการหนึ่ง ยอดรวมต้องลดลงตาม", async () => {
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "ลบ ชาเย็น" }).click();
    await expect(page.getByText("ชาเย็น")).toHaveCount(0, { timeout: 30_000 });
    await expect(page.getByTestId("food-totals")).toContainText("590");
  });

  await test.step("เมนูที่เคยกินกดซ้ำได้ และได้ตัวเลขเดิมโดยไม่ต้องเรียก AI", async () => {
    const chip = page.getByRole("button", { name: "ข้าวมันไก่", exact: true });
    await expect(chip).toBeVisible();
    await chip.click();

    await expect(page.getByLabel("ชื่อเมนู")).toHaveValue("ข้าวมันไก่");
    await expect(page.getByLabel("พลังงาน", { exact: true })).toHaveValue("590");
    await expect(page.getByLabel("โปรตีน", { exact: true })).toHaveValue("28");
    await expect(page.getByText("ใช้ค่าที่เคยบันทึกไว้")).toBeVisible();
  });

  await test.step("หน้าแรกมีการ์ดสรุปอาหารวันนี้ และกดเข้าหน้านับแคลได้", async () => {
    await gotoApp(page, "/dashboard");
    const card = page.getByText("อาหารวันนี้").locator("..").locator("..");
    await expect(card).toContainText("590");
    await card.getByRole("link", { name: /บันทึกเพิ่ม/ }).click();
    await expect(page).toHaveURL(/\/food$/);
  });

  /**
   * กราฟย้อนหลัง — จุดที่พลาดง่ายคือขอบท้ายของช่วง ถ้า query ใช้ `<` กับวันนี้
   * บันทึกของวันนี้จะหายไปจากกราฟทั้งหมดโดยไม่มีอะไรฟ้อง
   */
  await test.step("กราฟย้อนหลังนับบันทึกของวันนี้ด้วย และสลับมุมมองได้", async () => {
    await page.getByRole("link", { name: "ย้อนหลัง", exact: true }).click();
    await expect(page).toHaveURL(/\/food\/history$/);

    for (const range of ["รายวัน", "รายสัปดาห์", "รายเดือน"]) {
      await page.getByRole("button", { name: range }).click();
      await expect(page.getByText(/เฉลี่ย/)).toContainText("590");
      await expect(page.getByText("ยังไม่มีบันทึกในช่วงนี้")).toHaveCount(0);
    }

    await test.step("เปลี่ยนสารอาหารแล้วกราฟเปลี่ยนตาม", async () => {
      await page.getByRole("button", { name: "โปรตีน" }).click();
      await expect(page.getByText(/เฉลี่ย/)).toContainText("28");
    });
  });
});

/**
 * Regression — ยอดของแต่ละคนต้องไม่ปนกัน
 *
 * ตอนแรกฟีเจอร์นี้รวมทุกแถวใน family_id ทั้งครอบครัว ยอดที่เห็นจึงเป็นของ
 * ทุกคนบวกกัน ซึ่งไม่มีความหมายเลยสำหรับการนับแคล และหน้าจอไม่ได้บอกไว้ด้วย
 * เทสต์นี้แดงกับโค้ดตอนนั้น ซึ่งคือตัวพิสูจน์ว่าบั๊กมีจริง
 */
test("สองคนในครอบครัวเดียวกัน ยอดไม่ปนกัน แต่เห็นของกันได้", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("foodown"), "ปุ้ย");
  await completeOnboarding(page, "ครอบครัวนับแคลร่วม");

  const member = await inviteMember(page, browser, uniqueEmail("foodmate"), "สมชาย");

  await test.step("แต่ละคนบันทึกของตัวเอง", async () => {
    await gotoApp(page, "/food");
    await addFood(page, "ข้าวมันไก่", [590, 72, 6, 28]);
    await expect(page.getByTestId("food-totals")).toContainText("590", { timeout: 30_000 });

    await gotoApp(member.page, "/food");
    await addFood(member.page, "ข้าวขาหมู", [900, 105, 30, 34]);
    await expect(member.page.getByTestId("food-totals")).toContainText("900", { timeout: 30_000 });
  });

  await test.step("ยอดของตัวเองต้องไม่รวมของอีกคน", async () => {
    await gotoApp(page, "/food");
    await expect(page.getByTestId("food-totals")).toContainText("590");
    // 1,490 คือยอดที่ปนกัน ซึ่งเป็นอาการของบั๊กเดิม
    await expect(page.getByTestId("food-totals")).not.toContainText("1,490");
    await expect(page.getByText("ข้าวขาหมู")).toHaveCount(0);
  });

  await test.step("แถบเลือกคนใช้ชื่อจริง ของตัวเองมีป้าย ฉัน และเห็นยอดของอีกคน", async () => {
    const bar = page.getByRole("tablist", { name: "เลือกคนที่จะดู" });
    await expect(bar.getByRole("tab", { name: /ปุ้ย.*ฉัน/ })).toHaveAttribute(
      "aria-selected",
      "true",
    );
    await expect(bar.getByRole("tab", { name: /สมชาย/ })).toContainText("900");
  });

  await test.step("กดดูของอีกคนได้ แต่ไม่มีปุ่มแก้หรือลบ และเพิ่มเมนูไม่ได้", async () => {
    await page.getByRole("tab", { name: /สมชาย/ }).click();
    await expect(page.getByText("ข้าวขาหมู")).toBeVisible({ timeout: 30_000 });
    await expect(page.getByTestId("food-totals")).toContainText("900");
    await expect(page.getByRole("button", { name: "ลบ ข้าวขาหมู" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "แก้ตัวเลขของ ข้าวขาหมู" })).toHaveCount(0);
    await expect(page.getByLabel("ชื่อเมนู")).toHaveCount(0);
    await expect(page.getByText(/ดูได้อย่างเดียว/)).toBeVisible();
  });

  await test.step("กราฟย้อนหลังผูกกับคนที่เลือก ไม่หลุดกลับไปเป็นของตัวเอง", async () => {
    await page.getByRole("link", { name: "ย้อนหลัง", exact: true }).click();
    await expect(page).toHaveURL(/\/food\/history\?u=/);
    await expect(page.getByText(/เฉลี่ย/)).toContainText("900");
  });

  await member.ctx.close();
});

/**
 * Regression — บันทึกย้อนหลัง
 *
 * คนลืมบันทึกเป็นเรื่องปกติ ถ้าลงได้แค่วันนี้ มื้อที่ลืมก็หายไปเลย แล้วกราฟ
 * จะโชว์วันที่ดูเหมือนกินน้อยทั้งที่จริงคือลืมจด ซึ่งเป็นการอ่านผิดที่อันตราย
 * กว่าการไม่มีกราฟ
 */
test("บันทึกย้อนหลังได้ ลงวันที่ถูก และไม่ปนกับวันนี้", async ({ page }) => {
  // ห้ามใส่คำว่า "ย้อนหลัง" ในชื่อคนหรือชื่อครอบครัว — ชื่อโผล่ใน aria-label
  // ของลิงก์โปรไฟล์และหัวแอป แล้วจะชนกับ selector ของลิงก์ "ย้อนหลัง"
  // (พลาดแบบเดียวกับ appt-time.spec.ts ที่ชื่อผู้ใช้ชนกับคำว่า "เวลา")
  await signUp(page, uniqueEmail("foodback"), "แม่เผลอลืมจด");
  await completeOnboarding(page, "ครอบครัวเผลอลืมจด");

  const yesterday = daysAgo(1);

  await test.step("วันนี้บันทึกหนึ่งเมนู", async () => {
    await gotoApp(page, "/food");
    await addFood(page, "ข้าวมันไก่", [590, 72, 6, 28]);
    await expect(page.getByTestId("food-totals")).toContainText("590", { timeout: 30_000 });
  });

  await test.step("ถอยไปเมื่อวาน หน้าเปล่าและบอกวันที่ให้ชัด", async () => {
    await page.getByRole("button", { name: /ดูวันก่อนหน้า/ }).click();
    await expect(page).toHaveURL(new RegExp(`d=${yesterday}`));
    await expect(page.getByText(/ยังไม่ได้บันทึกอะไร วันที่/)).toBeVisible({ timeout: 30_000 });
    // หัวข้อฟอร์มต้องบอกว่ากำลังลงวันไหน ไม่งั้นกรอกไปลงวันนี้โดยไม่รู้ตัว
    await expect(page.getByRole("heading", { name: /ย้อนหลังวันที่/ })).toBeVisible();
  });

  await test.step("เพิ่มเมนูของเมื่อวาน ยอดขึ้นที่วันนั้น", async () => {
    await addFood(page, "ก๋วยเตี๋ยว", [420, 60, 8, 20]);
    await expect(page.getByTestId("food-totals")).toContainText("420", { timeout: 30_000 });
    await expect(page.getByTestId("food-list")).toContainText("ก๋วยเตี๋ยว");
    // ของวันนี้ต้องไม่หลุดมาอยู่ในรายการของเมื่อวาน
    // (ยึดที่รายการของวัน ไม่ใช่ทั้งหน้า — ชิป "เคยกิน" เป็นเมนูข้ามวันโดยตั้งใจ)
    await expect(page.getByTestId("food-list")).not.toContainText("ข้าวมันไก่");
  });

  await test.step("กลับมาวันนี้ ยอดของวันนี้ไม่เปลี่ยน", async () => {
    await page.getByRole("button", { name: "วันนี้" }).click();
    await expect(page.getByTestId("food-totals")).toContainText("590", { timeout: 30_000 });
    await expect(page.getByTestId("food-list")).not.toContainText("ก๋วยเตี๋ยว");
  });

  await test.step("ไปข้างหน้าไม่ได้ — วันอนาคตยังไม่เกิดขึ้น", async () => {
    await expect(page.getByRole("button", { name: /ดูวันถัดไป/ })).toHaveCount(0);
    await expect(page.getByLabel("วันที่ของบันทึก")).toHaveAttribute("max", await nowDay(page));
  });

  await test.step("กราฟรายวันกดที่แท่งแล้วไปที่วันนั้นเพื่อแก้ได้", async () => {
    await page.getByRole("link", { name: "ย้อนหลัง", exact: true }).click();
    await page.getByRole("link", { name: new RegExp("เปิดวันนี้เพื่อแก้") }).last().click();
    await expect(page).toHaveURL(/\/food(\?|$)/);
  });
});

/** วันนี้ตามที่หน้าเว็บคิด — เทียบกับ max ของช่องวันที่ */
async function nowDay(page: import("@playwright/test").Page) {
  return page.getByLabel("วันที่ของบันทึก").inputValue();
}
