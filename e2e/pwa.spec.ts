import { expect, test } from "@playwright/test";

/**
 * ติดตั้งลงจอโฮมได้
 *
 * ทุกข้อที่เช็คตรงนี้คือสิ่งที่ถ้าพังแล้ว **ปุ่มติดตั้งจะไม่โผล่เลย** โดยไม่มี error
 * ให้เห็นที่ไหน — เบราว์เซอร์เงียบๆ ไม่เสนอให้ติดตั้ง ซึ่งหาสาเหตุยากมาก
 */
test("manifest เปิดได้โดยไม่ล็อกอิน และมีของครบสำหรับติดตั้ง", async ({ browser }) => {
  const ctx = await browser.newContext();
  const page = await ctx.newPage();

  // เบราว์เซอร์ดึง manifest โดยไม่ส่ง cookie — ถ้า middleware ไม่ปล่อยผ่าน
  // จะโดนพาไป /login แล้วการติดตั้งพังทั้งที่ผู้ใช้ล็อกอินอยู่
  const res = await page.request.get("http://localhost:8788/manifest.webmanifest");
  expect(res.status(), "manifest ต้องเปิดได้โดยไม่ล็อกอิน").toBe(200);

  const m = (await res.json()) as {
    name: string;
    short_name: string;
    start_url: string;
    display: string;
    theme_color: string;
    icons: { src: string; sizes: string; purpose?: string }[];
  };
  expect(m.display).toBe("standalone");
  expect(m.short_name.length).toBeLessThanOrEqual(12); // ยาวกว่านี้จอโฮมจะตัดคำ
  expect(m.start_url).toBe("/");

  // ต้องมีทั้ง 192 และ 512 ไม่งั้น Android ไม่เสนอให้ติดตั้ง
  for (const size of ["192x192", "512x512"]) {
    expect(m.icons.some((i) => i.sizes === size && i.purpose !== "maskable"), `ขาดไอคอน ${size}`).toBe(true);
    expect(m.icons.some((i) => i.sizes === size && i.purpose === "maskable"), `ขาดไอคอน maskable ${size}`).toBe(true);
  }

  // ไฟล์ไอคอนต้องมีอยู่จริง — ชื่อผิดแล้วเบราว์เซอร์เงียบ ไม่ฟ้องอะไรเลย
  for (const icon of m.icons) {
    const r = await page.request.get(`http://localhost:8788${icon.src}`);
    expect(r.status(), `${icon.src} ต้องโหลดได้`).toBe(200);
    expect(r.headers()["content-type"]).toContain("image/png");
  }

  await test.step("สีแถบสถานะต้องตรงกับที่หน้าเว็บประกาศ", async () => {
    await page.goto("/login");
    const meta = await page.locator('meta[name="theme-color"]').first().getAttribute("content");
    expect(meta?.toUpperCase(), "ไม่ตรงกันแล้วแถบสถานะจะเปลี่ยนสีตอนเปิดแอป").toBe(
      m.theme_color.toUpperCase(),
    );
  });

  await test.step("มีแท็กบอกว่าเปิดแบบเต็มจอได้ ทั้งชื่อมาตรฐานและชื่อเดิมของ Apple", async () => {
    // iOS ตั้งแต่ 16.4 อ่าน display: standalone จาก manifest ได้แล้ว
    // แต่เครื่องเก่ากว่านั้นรู้จักแค่ชื่อเดิมของ Apple — ต้องมีทั้งคู่
    for (const name of ["mobile-web-app-capable", "apple-mobile-web-app-capable"]) {
      const cap = await page.locator(`meta[name="${name}"]`).first().getAttribute("content");
      expect(cap, `ขาด meta ${name}`).toBe("yes");
    }
  });

  await ctx.close();
});
