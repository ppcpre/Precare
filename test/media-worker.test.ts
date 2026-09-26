import { beforeAll, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { handleMedia, type MediaEnv } from "../workers/media";
import { createMediaToken, familyScope } from "@/lib/media-token";
import { getMediaSecret, resetMediaSecretCache } from "@/lib/media-secret";

/**
 * worker เสิร์ฟไฟล์ — เทสต์กับ R2 กับ D1 ของจริง (ในหน่วยความจำ) ไม่ใช่ mock
 *
 * เส้นทางวิดีโอไม่มีทางทดสอบจากเบราว์เซอร์ใน e2e ได้ครบ เพราะ Chromium
 * เป็นคนตัดสินเองว่าจะขอช่วงไหนบ้าง ตรงนี้จึงเป็นที่เดียวที่ยืนยัน 206 ได้แน่ๆ
 */
const KEY = "family/fam-1/photos/pic.webp";
const VIDEO = "family/fam-1/videos/clip.mp4";
const BODY = new Uint8Array(1024).fill(7);

let token: string;
const mediaEnv = () => env as unknown as MediaEnv;

beforeAll(async () => {
  await env.PHOTOS_BUCKET.put(KEY, BODY, { httpMetadata: { contentType: "image/webp" } });
  await env.PHOTOS_BUCKET.put(VIDEO, BODY);
  resetMediaSecretCache();
  token = await createMediaToken(await getMediaSecret(env.DB), familyScope("fam-1"));
});

const get = (path: string, init?: RequestInit) =>
  handleMedia(new Request(`https://media.test/${path}`, init), mediaEnv());

describe("worker เสิร์ฟไฟล์", () => {
  it("มีตั๋วถูกต้อง ได้ไฟล์", async () => {
    const res = await get(`${KEY}?t=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/webp");
    // ห้าม public เด็ดขาด — CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
    expect(res.headers.get("cache-control")).toContain("private");
    expect(new Uint8Array(await res.arrayBuffer()).length).toBe(BODY.length);
  });

  it("ไม่มีตั๋ว / ตั๋วมั่ว / ตั๋วของครอบครัวอื่น = 404 เหมือนกันหมด", async () => {
    expect((await get(KEY)).status).toBe(404);
    expect((await get(`${KEY}?t=abc`)).status).toBe(404);
    const other = await createMediaToken(await getMediaSecret(env.DB), familyScope("fam-2"));
    expect((await get(`${KEY}?t=${other}`)).status).toBe(404);
  });

  it("ไฟล์ที่ไม่มีอยู่ = 404 ไม่ใช่ 500", async () => {
    expect((await get(`family/fam-1/photos/none.webp?t=${token}`)).status).toBe(404);
  });

  it("วิดีโอตอบ 206 พร้อม content-range ตามที่ขอ", async () => {
    const res = await get(`${VIDEO}?t=${token}`, { headers: { range: "bytes=100-199" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-range")).toBe(`bytes 100-199/${BODY.length}`);
    expect(res.headers.get("content-length")).toBe("100");
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-type")).toBe("video/mp4");
  });

  it("วิดีโอไม่มีหัว Range ตอบทั้งไฟล์ แต่ยังบอกว่ารองรับ Range", async () => {
    const res = await get(`${VIDEO}?t=${token}`);
    expect(res.status).toBe(200);
    expect(res.headers.get("accept-ranges")).toBe("bytes");
    expect(res.headers.get("content-length")).toBe(String(BODY.length));
  });

  /** เส้นทางที่ Safari ใช้จริงก่อนเริ่มเล่น — ตอบผิดแล้วเครื่องเล่นค้างเงียบๆ */
  it("suffix range ต้องได้ท้ายไฟล์เป็น 206 ไม่ใช่ทั้งไฟล์เป็น 200", async () => {
    const res = await get(`${VIDEO}?t=${token}`, { headers: { range: "bytes=-64" } });
    expect(res.status).toBe(206);
    expect(res.headers.get("content-length")).toBe("64");
    expect(res.headers.get("content-range")).toBe(`bytes ${BODY.length - 64}-${BODY.length - 1}/${BODY.length}`);
    expect(new Uint8Array(await res.arrayBuffer()).length).toBe(64);
  });

  it("ช่วงที่ขอเกินไฟล์ ไม่ทำให้พัง — ส่งทั้งไฟล์แทน", async () => {
    const res = await get(`${VIDEO}?t=${token}`, { headers: { range: "bytes=99999-" } });
    expect(res.status).toBe(200);
  });

  it("healthz ตอบได้โดยไม่ต้องมีตั๋ว", async () => {
    const res = await get("healthz");
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("ok");
  });

  it("เขียนไฟล์ผ่าน worker นี้ไม่ได้", async () => {
    expect((await get(`${KEY}?t=${token}`, { method: "POST" })).status).toBe(405);
  });
});
