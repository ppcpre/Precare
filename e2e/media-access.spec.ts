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

/**
 * อัปคลิปครบวงจร: start -> part -> complete
 *
 * ไฟล์ 500 MB ส่งคำขอเดียวไม่ได้ (Cloudflare จำกัด body 100 MB บนแพลนฟรี)
 * เส้นทางนี้จึงเป็น multipart ทุกครั้ง แม้ไฟล์เล็กก็ยังเดินสามขั้นตอนเดิม
 */
async function uploadClip(
  req: import("@playwright/test").APIRequestContext,
  bytes: number,
  type = "video/mp4",
) {
  const startRes = await req.post(VIDEO_URL, {
    headers: { "x-upload-phase": "start", "x-video-type": type, "x-video-size": String(bytes) },
  });
  if (startRes.status() !== 200) return { status: startRes.status(), body: await startRes.json() };
  const { key, uploadId } = (await startRes.json()) as { key: string; uploadId: string };
  const h = { "x-upload-key": key, "x-upload-id": uploadId };

  const partRes = await req.post(VIDEO_URL, {
    headers: { ...h, "x-upload-phase": "part", "x-part-number": "1" },
    data: fakeClip(bytes),
  });
  if (partRes.status() !== 200) return { status: partRes.status(), body: await partRes.json() };
  const uploaded = await partRes.json();

  const done = await req.post(VIDEO_URL, {
    headers: { ...h, "x-upload-phase": "complete", "content-type": "application/json" },
    data: { parts: [uploaded] },
  });
  return { status: done.status(), body: await done.json(), key, uploadId };
}

test("อัปโหลดวิดีโอ: ด่านสิทธิ์และลิมิตต้องกันได้ก่อนเขียนไฟล์", async ({ page, browser }) => {
  await test.step("ไม่ได้ล็อกอินต้องได้ 401", async () => {
    const ctx = await browser.newContext();
    const res = await ctx.request.post(VIDEO_URL, {
      headers: { "x-upload-phase": "start", "x-video-type": "video/mp4", "x-video-size": "1024" },
    });
    expect(res.status()).toBe(401);
    await ctx.close();
  });

  await signUp(page, uniqueEmail("videoowner"), "แม่อัปคลิป");
  await completeOnboarding(page, "ครอบครัวอัปคลิป");

  await test.step("ชนิดที่ไม่รองรับต้องได้ 415", async () => {
    const res = await uploadClip(page.request, 1024, "video/webm");
    expect(res.status).toBe(415);
  });

  await test.step(".mov ต้องอัปได้ และเสิร์ฟกลับเป็น quicktime", async () => {
    // นามสกุลบน key ต้องตามชนิดจริง เพราะเส้นทางเสิร์ฟใช้นามสกุลตัดสินว่า
    // จะตอบแบบวิดีโอ (Range/206) หรือแบบรูป (อ่านทั้งก้อนเข้าหน่วยความจำ)
    // ถ้าพลาดตรงนี้ คลิป 40 MB จะถูกอ่านทั้งก้อนใน worker ที่มีเพดาน 128 MB
    const res = await uploadClip(page.request, 4096, "video/quicktime");
    expect(res.status).toBe(200);
    const key = (res.body as { key: string }).key;
    expect(key).toMatch(/\.mov$/);

    const back = await page.request.get(`http://localhost:8788/api/media/${key}`, {
      headers: { range: "bytes=0-9" },
    });
    expect(back.status()).toBe(206);
    expect(back.headers()["content-type"]).toBe("video/quicktime");
  });

  await test.step("หลายชิ้นต้องประกอบกลับเป็นไฟล์เดียวที่ไบต์ถูกต้อง", async () => {
    /**
     * นี่คือใจกลางของการรองรับ 500 MB — ชิ้นเดียวไม่ได้พิสูจน์อะไรเลย
     * ต้องเห็นว่าลำดับชิ้น การเก็บ etag และการประกอบกลับทำงานจริง
     *
     * R2 บังคับว่าทุกชิ้นยกเว้นชิ้นสุดท้ายต้องไม่ต่ำกว่า 5 MiB และเท่ากันหมด
     * จึงใช้ 5 MiB + ชิ้นท้าย 1 MiB
     */
    const big = 5 * 1024 ** 2;
    const tail = 1024 ** 2;
    const startRes = await page.request.post(VIDEO_URL, {
      headers: {
        "x-upload-phase": "start",
        "x-video-type": "video/mp4",
        "x-video-size": String(big + tail),
      },
    });
    const { key, uploadId } = (await startRes.json()) as { key: string; uploadId: string };
    const h = { "x-upload-key": key, "x-upload-id": uploadId };

    const parts = [];
    for (const [i, bytes] of [big, tail].entries()) {
      const res = await page.request.post(VIDEO_URL, {
        headers: { ...h, "x-upload-phase": "part", "x-part-number": String(i + 1) },
        // ไบต์ต่างกันต่อชิ้น จะได้จับได้ถ้าชิ้นสลับที่กัน
        data: Buffer.alloc(bytes, i + 1),
      });
      expect(res.status()).toBe(200);
      parts.push(await res.json());
    }

    const done = await page.request.post(VIDEO_URL, {
      headers: { ...h, "x-upload-phase": "complete", "content-type": "application/json" },
      data: { parts },
    });
    expect(done.status()).toBe(200);
    expect(((await done.json()) as { size: number }).size).toBe(big + tail);

    // ไบต์แรกต้องมาจากชิ้นแรก และไบต์หลังรอยต่อต้องมาจากชิ้นที่สอง
    const head = await page.request.get(`http://localhost:8788/api/media/${key}`, {
      headers: { range: "bytes=0-0" },
    });
    expect((await head.body())[0]).toBe(1);
    const after = await page.request.get(`http://localhost:8788/api/media/${key}`, {
      headers: { range: `bytes=${big}-${big}` },
    });
    expect((await after.body())[0]).toBe(2);
  });

  await test.step("แจ้งขนาดเกินเพดานต้องถูกปฏิเสธตั้งแต่ start ก่อนส่งไบต์สักตัว", async () => {
    // ด่านนี้สำคัญเพราะไฟล์ 500 MB ที่ปล่อยให้ส่งจนจบแล้วค่อยปฏิเสธ
    // คือการเผาเน็ตของผู้ใช้ทิ้งทั้งก้อน
    const res = await page.request.post(VIDEO_URL, {
      headers: {
        "x-upload-phase": "start",
        "x-video-type": "video/mp4",
        "x-video-size": String(600 * 1024 ** 2),
      },
    });
    expect(res.status()).toBe(413);
  });

  await test.step("รอบอัปโหลดของครอบครัวอื่นต้องแตะไม่ได้", async () => {
    const mine = await page.request.post(VIDEO_URL, {
      headers: { "x-upload-phase": "start", "x-video-type": "video/mp4", "x-video-size": "2048" },
    });
    const { key, uploadId } = (await mine.json()) as { key: string; uploadId: string };

    const ctx = await browser.newContext();
    const other = await ctx.newPage();
    await signUp(other, uniqueEmail("videoidor"), "คนอื่นคลิป");
    await completeOnboarding(other, "ครอบครัวคนอื่นคลิป");

    // key เดาได้ (family/<id>/videos/<uuid>.mp4) ถ้าไม่ผูกกับ familyId ใน session
    // สมาชิกครอบครัวหนึ่งจะเขียนทับรอบอัปโหลดของอีกครอบครัวได้
    const steal = await other.request.post(VIDEO_URL, {
      headers: {
        "x-upload-key": key,
        "x-upload-id": uploadId,
        "x-upload-phase": "part",
        "x-part-number": "1",
      },
      data: fakeClip(1024),
    });
    expect(steal.status()).toBe(404);
    await ctx.close();

    await page.request.post(VIDEO_URL, {
      headers: { "x-upload-key": key, "x-upload-id": uploadId, "x-upload-phase": "abort" },
    });
  });

  // เพดาน 500 MB ไม่ได้ทดสอบด้วยไบต์จริงตรงนี้โดยตั้งใจ — ต้องส่งไบต์จริง 41 MB ต่อ project
  // ต่อรัน ซึ่งนอกจากช้าแล้วยังทำให้ worker ปิดการเชื่อมต่อกลางคัน
  // (route ตอบ 413 ตั้งแต่อ่านหัว โดยไม่อ่าน body) แล้วโยน
  // "Network connection lost" ลง log ปนกับอาการไม่เสถียรของ wrangler ที่มีอยู่แล้ว
  // ตัวเลขเพดานคุมด้วย test/video.test.ts แทน

  await test.step("ของจริงต้องได้ key ที่อยู่ใต้ครอบครัวตัวเอง", async () => {
    const res = await uploadClip(page.request, 2048);
    expect(res.status).toBe(200);
    const body = res.body as { key: string; size: number };
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
