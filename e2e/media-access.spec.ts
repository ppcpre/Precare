import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, makePng, pickFiles, signUp, uniqueEmail } from "./helpers";

/**
 * T6.5 — ไฟล์ใน bucket private ต้องผูกสิทธิ์กับเจ้าของจริง
 *
 * เดิม /api/media/[...key] เช็คแค่ว่ามี session ไหม ใครมีบัญชีก็เปิดรูปของ
 * ครอบครัวอื่นได้ถ้ารู้ key ซึ่ง key เดาได้จากรูปแบบ family/<id>/photos/<uuid>
 */
test.describe.configure({ mode: "serial" });

test("คนนอกครอบครัวเปิดรูปด้วย URL ตรงๆ ไม่ได้", async ({ page, browser }) => {
  await signUp(page, uniqueEmail("mediaowner"), "แม่เจ้าของรูป");
  await completeOnboarding(page, "ครอบครัวเจ้าของรูป");

  await gotoApp(page, "/album/upload");
  await pickFiles(page, [
    { name: "secret.png", mimeType: "image/png", buffer: makePng(1800, 1400, 9) },
  ]);
  await page.getByRole("button", { name: /เพิ่ม 1 ไฟล์/ }).click();
  await page.waitForURL(/\/album$/, { timeout: 45_000 });

  const mediaUrl = await page
    .locator('img[src^="/api/media/"]')
    .first()
    .getAttribute("src");
  expect(mediaUrl).toBeTruthy();

  await test.step("เจ้าของเปิดได้ปกติ", async () => {
    const res = await page.request.get(mediaUrl!);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("image/");
    // ห้าม public — CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
    expect(res.headers()["cache-control"]).toContain("private");
  });

  await test.step("คนที่ล็อกอินอยู่แต่คนละครอบครัว ต้องได้ 404", async () => {
    const ctx = await browser.newContext();
    const stranger = await ctx.newPage();
    await signUp(stranger, uniqueEmail("stranger"), "คนแปลกหน้า");
    await completeOnboarding(stranger, "ครอบครัวคนแปลกหน้า");

    const res = await stranger.request.get(mediaUrl!);
    // 404 ไม่ใช่ 403 — คนนอกไม่ควรรู้ด้วยซ้ำว่าไฟล์นี้มีอยู่จริง
    expect(res.status()).toBe(404);

    await ctx.close();
  });

  await test.step("ไม่ได้ล็อกอินต้องได้ 401", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.get(`http://localhost:8788${mediaUrl}`);
    expect(res.status()).toBe(401);
    await ctx.close();
  });
});

/**
 * เส้นทางอัปโหลดวิดีโอไม่ได้ผ่าน safe-action chain จึงไม่ถูก
 * scripts/check-authz.mjs ตรวจให้ — การตรวจสิทธิ์ตรงนั้นเขียนมือ
 * เทสต์ชุดนี้คือสิ่งเดียวที่คุมมันไว้ ถ้าลบ ต้องหาอย่างอื่นมาแทนก่อน
 *
 * ไม่ได้ทดสอบคลิปจริง เพราะสร้าง mp4 ที่เบราว์เซอร์ถอดรหัสได้โดยไม่มี ffmpeg
 * ไม่ได้ ตัว route ไม่ได้ถอดรหัสไฟล์อยู่แล้ว ไบต์สมมติจึงพอสำหรับด่านสิทธิ์และลิมิต
 * ส่วนขาที่เบราว์เซอร์อ่านความยาวและดึงหน้าปก ยังต้องทดสอบด้วยมือบนเครื่องจริง
 */
const VIDEO_URL = "http://localhost:8788/api/media/video";
const fakeClip = (bytes: number) => Buffer.alloc(bytes, 7);

test("อัปโหลดวิดีโอ: ด่านสิทธิ์และลิมิตต้องกันได้ก่อนเขียนไฟล์", async ({ page, browser }) => {
  await test.step("ไม่ได้ล็อกอินต้องได้ 401", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.post(VIDEO_URL, {
      headers: { "content-type": "video/mp4" },
      data: fakeClip(1024),
    });
    expect(res.status()).toBe(401);
    await ctx.close();
  });

  await signUp(page, uniqueEmail("videoowner"), "แม่อัปคลิป");
  await completeOnboarding(page, "ครอบครัวอัปคลิป");

  await test.step("ไฟล์ที่ไม่ใช่ mp4 ต้องได้ 415", async () => {
    const res = await page.request.post(VIDEO_URL, {
      headers: { "content-type": "video/quicktime" },
      data: fakeClip(1024),
    });
    expect(res.status()).toBe(415);
  });

  // เพดาน 40 MB ไม่ได้ทดสอบตรงนี้โดยตั้งใจ — ต้องส่งไบต์จริง 41 MB ต่อ project
  // ต่อรัน ซึ่งนอกจากช้าแล้วยังทำให้ worker ปิดการเชื่อมต่อกลางคัน
  // (route ตอบ 413 ตั้งแต่อ่านหัว โดยไม่อ่าน body) แล้วโยน
  // "Network connection lost" ลง log ปนกับอาการไม่เสถียรของ wrangler ที่มีอยู่แล้ว
  // ตัวเลขเพดานคุมด้วย test/video.test.ts แทน

  await test.step("ของจริงต้องได้ key ที่อยู่ใต้ครอบครัวตัวเอง", async () => {
    const res = await page.request.post(VIDEO_URL, {
      headers: { "content-type": "video/mp4" },
      data: fakeClip(2048),
    });
    expect(res.status()).toBe(200);
    const body = (await res.json()) as { key: string; size: number };
    expect(body.size).toBe(2048);
    // key ต้องมาจาก session เสมอ ห้ามให้ client กำหนดปลายทางเองได้
    expect(body.key).toMatch(/^family\/[^/]+\/videos\/[0-9a-f-]+\.mp4$/);

    await test.step("คลิปที่ยังไม่ผูกกับอัลบั้ม คนอื่นก็เปิดไม่ได้", async () => {
      const ctx = await browser.newContext();
      const stranger = await ctx.newPage();
      await signUp(stranger, uniqueEmail("videostranger"), "คนแปลกหน้าคลิป");
      await completeOnboarding(stranger, "ครอบครัวแปลกหน้าคลิป");
      const peek = await stranger.request.get(`http://localhost:8788/api/media/${body.key}`);
      expect(peek.status()).toBe(404);
      await ctx.close();
    });

    await test.step("เจ้าของเปิดได้ และตอบเป็นช่วงไบต์ให้เครื่องเล่นได้", async () => {
      const full = await page.request.get(`http://localhost:8788/api/media/${body.key}`);
      expect(full.status()).toBe(200);
      expect(full.headers()["accept-ranges"]).toBe("bytes");

      // เบราว์เซอร์ขอวิดีโอเป็นช่วงเสมอ ถ้าไม่ตอบ 206 การเลื่อนแถบเวลาจะพัง
      // และ Safari จะไม่ยอมเริ่มเล่นเลย
      const part = await page.request.get(`http://localhost:8788/api/media/${body.key}`, {
        headers: { range: "bytes=0-99" },
      });
      expect(part.status()).toBe(206);
      expect(part.headers()["content-range"]).toBe("bytes 0-99/2048");
      expect((await part.body()).length).toBe(100);
    });
  });
});
