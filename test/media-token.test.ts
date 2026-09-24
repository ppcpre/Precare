import { describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import {
  MEDIA_TOKEN_TTL_MS,
  createMediaToken,
  familyScope,
  userScope,
  verifyMediaToken,
} from "@/lib/media-token";
import { getMediaSecret, resetMediaSecretCache } from "@/lib/media-secret";

const SECRET = "test-secret-do-not-use-anywhere-else";
const KEY = "family/fam-1/photos/abc.webp";

describe("ตั๋วเข้าถึงไฟล์", () => {
  it("ตั๋วที่เซ็นถูกต้องเปิดไฟล์ในขอบเขตตัวเองได้", async () => {
    const t = await createMediaToken(SECRET, familyScope("fam-1"));
    expect(await verifyMediaToken(SECRET, t, KEY)).toBe(true);
  });

  /** จุดตายของทั้งเรื่อง — ถ้าตรวจแค่ลายเซ็น ตั๋วของเราจะเปิดไฟล์ครอบครัวอื่นได้ */
  it("ตั๋วของครอบครัวหนึ่งเปิดไฟล์ของอีกครอบครัวไม่ได้", async () => {
    const t = await createMediaToken(SECRET, familyScope("fam-1"));
    expect(await verifyMediaToken(SECRET, t, "family/fam-2/photos/abc.webp")).toBe(false);
  });

  /** ไม่มี / ปิดท้าย `family/fam-1` จะเปิดของ `family/fam-1x` ได้ด้วย startsWith */
  it("ขอบเขตต้องไม่เผลอครอบ id ที่ขึ้นต้นเหมือนกัน", async () => {
    const t = await createMediaToken(SECRET, familyScope("fam-1"));
    expect(await verifyMediaToken(SECRET, t, "family/fam-1x/photos/abc.webp")).toBe(false);
  });

  it("ตั๋วของผู้ใช้เปิดได้แต่ไฟล์ของตัวเอง", async () => {
    const t = await createMediaToken(SECRET, userScope("u-1"));
    expect(await verifyMediaToken(SECRET, t, "user/u-1/avatar.webp")).toBe(true);
    expect(await verifyMediaToken(SECRET, t, "user/u-2/avatar.webp")).toBe(false);
  });

  /** URL ต้องซ้ำได้ในช่วงเวลาใกล้กัน ไม่งั้นแคชของเบราว์เซอร์ใช้ไม่ได้เลย */
  it("ออกตั๋วห่างกันไม่กี่นาที ได้ตั๋วเดิม", async () => {
    const now = Date.UTC(2026, 0, 1, 10, 5);
    const a = await createMediaToken(SECRET, familyScope("fam-1"), now);
    const b = await createMediaToken(SECRET, familyScope("fam-1"), now + 10 * 60_000);
    expect(b).toBe(a);
    // ข้ามช่วงแล้วค่อยเปลี่ยน
    const c = await createMediaToken(SECRET, familyScope("fam-1"), now + 31 * 60_000);
    expect(c).not.toBe(a);
  });

  it("หมดอายุแล้วใช้ไม่ได้", async () => {
    const now = Date.now();
    const t = await createMediaToken(SECRET, familyScope("fam-1"), now);
    // ปัดเวลาออกตั๋วลง อายุที่เหลือจริงจึงสั้นกว่า TTL ได้ถึงหนึ่งช่วง (30 นาที)
    expect(await verifyMediaToken(SECRET, t, KEY, now + MEDIA_TOKEN_TTL_MS - 31 * 60_000)).toBe(true);
    expect(await verifyMediaToken(SECRET, t, KEY, now + MEDIA_TOKEN_TTL_MS + 2000)).toBe(false);
  });

  it("กุญแจคนละดอกใช้ไม่ได้ — กันสองฝั่งตั้งค่าไม่ตรงกันแล้วเงียบ", async () => {
    const t = await createMediaToken(SECRET, familyScope("fam-1"));
    expect(await verifyMediaToken("another-secret", t, KEY)).toBe(false);
  });

  it("แก้วันหมดอายุหรือลายเซ็นแล้วใช้ไม่ได้", async () => {
    const t = await createMediaToken(SECRET, familyScope("fam-1"));
    const [scope, exp, sig] = t.split(".");
    expect(await verifyMediaToken(SECRET, `${scope}.${Number(exp) + 99999}.${sig}`, KEY)).toBe(false);
    expect(await verifyMediaToken(SECRET, `${scope}.${exp}.${sig.slice(0, -2)}xy`, KEY)).toBe(false);
    expect(await verifyMediaToken(SECRET, "ขยะ", KEY)).toBe(false);
    expect(await verifyMediaToken(SECRET, "", KEY)).toBe(false);
  });

  it("ขอบเขตที่ไม่ได้รูปแบบ ออกตั๋วไม่ได้เลย", async () => {
    await expect(createMediaToken(SECRET, "family/fam-1")).rejects.toThrow();
    await expect(createMediaToken(SECRET, "../")).rejects.toThrow();
    await expect(createMediaToken(SECRET, "")).rejects.toThrow();
  });
});

describe("กุญแจเซ็นตั๋วใน D1", () => {
  it("สร้างครั้งเดียวแล้วได้ค่าเดิมทุกครั้ง — สองฝั่งจึงตรงกันเสมอ", async () => {
    resetMediaSecretCache();
    const first = await getMediaSecret(env.DB);
    resetMediaSecretCache();
    const second = await getMediaSecret(env.DB);
    expect(second).toBe(first);
    expect(first.length).toBeGreaterThan(20);

    // ตั๋วที่เซ็นด้วยกุญแจจาก D1 ต้องใช้ข้ามฝั่งได้จริง
    const t = await createMediaToken(first, familyScope("fam-9"));
    expect(await verifyMediaToken(second, t, "family/fam-9/videos/x.mp4")).toBe(true);
  });
});
