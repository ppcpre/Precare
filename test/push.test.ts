import { describe, expect, it } from "vitest";
import { importVapidKey, vapidAuthHeader } from "@/lib/push";

/**
 * คู่คีย์สำหรับทดสอบเท่านั้น สร้างขึ้นสดในเทสต์ ไม่ใช่คีย์จริงของใคร
 * (คีย์จริงอยู่ใน secret ของ Cloudflare และไม่มีวันเข้ามาอยู่ในโค้ด)
 */
async function throwawayKeys() {
  const pair = await crypto.subtle.generateKey({ name: "ECDSA", namedCurve: "P-256" }, true, [
    "sign",
    "verify",
  ]);
  const raw = new Uint8Array(await crypto.subtle.exportKey("raw", pair.publicKey));
  const jwk = await crypto.subtle.exportKey("jwk", pair.privateKey);
  const b64url = (b: Uint8Array) =>
    btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { publicKey: b64url(raw), privateKey: jwk.d as string, verifyKey: pair.publicKey };
}

const b64urlToBytes = (s: string) =>
  Uint8Array.from(
    atob(s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")),
    (c) => c.charCodeAt(0),
  );

describe("VAPID", () => {
  it("ประกอบกุญแจจากคู่คีย์ที่ web-push สร้างได้", async () => {
    const k = await throwawayKeys();
    await expect(importVapidKey(k.publicKey, k.privateKey)).resolves.toBeDefined();
  });

  it("public key ที่ไม่ใช่จุดแบบไม่บีบอัด 65 ไบต์ ต้องฟ้องทันที", async () => {
    const k = await throwawayKeys();
    await expect(importVapidKey("c2hvcnQ", k.privateKey)).rejects.toThrow(/65 ไบต์/);
  });

  /**
   * ข้อที่สำคัญที่สุด: ลายเซ็นต้องผ่านการตรวจด้วยคีย์สาธารณะจริง
   * ถ้าเซ็นผิดรูปแบบ เซิร์ฟเวอร์ push จะตอบ 401 โดยไม่บอกว่าผิดตรงไหน
   */
  it("ลายเซ็นตรวจสอบได้ด้วยคีย์สาธารณะ", async () => {
    const k = await throwawayKeys();
    const header = await vapidAuthHeader({
      endpoint: "https://fcm.googleapis.com/fcm/send/abc123",
      publicKey: k.publicKey,
      privateKey: k.privateKey,
      subject: "mailto:test@example.com",
    });

    const m = header.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(m, "รูปแบบ header ต้องเป็น 'vapid t=..., k=...'").not.toBeNull();
    const [h, p, sig] = m![1].split(".");
    expect(m![2]).toBe(k.publicKey);

    const ok = await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      k.verifyKey,
      b64urlToBytes(sig),
      new TextEncoder().encode(`${h}.${p}`),
    );
    expect(ok, "ลายเซ็นไม่ผ่านการตรวจ").toBe(true);
  });

  it("aud ต้องเป็น origin ของเซิร์ฟเวอร์ push ไม่ใช่ URL เต็ม", async () => {
    const k = await throwawayKeys();
    const header = await vapidAuthHeader({
      endpoint: "https://web.push.apple.com/QWERTY/asdf?x=1",
      publicKey: k.publicKey,
      privateKey: k.privateKey,
      subject: "mailto:test@example.com",
      now: 1_700_000_000_000,
    });
    const payload = JSON.parse(
      new TextDecoder().decode(b64urlToBytes(header.split(".")[1])),
    ) as { aud: string; exp: number; sub: string };
    expect(payload.aud).toBe("https://web.push.apple.com");
    expect(payload.sub).toBe("mailto:test@example.com");
    // สเปกกำหนดไม่เกิน 24 ชั่วโมง
    expect(payload.exp - 1_700_000_000).toBeLessThanOrEqual(24 * 60 * 60);
    expect(payload.exp - 1_700_000_000).toBeGreaterThan(0);
  });

  it("header เปลี่ยนตาม endpoint — ใช้ซ้ำข้าม push service ไม่ได้", async () => {
    const k = await throwawayKeys();
    const opts = { publicKey: k.publicKey, privateKey: k.privateKey, subject: "mailto:a@b.c" };
    const a = await vapidAuthHeader({ ...opts, endpoint: "https://fcm.googleapis.com/x" });
    const b = await vapidAuthHeader({ ...opts, endpoint: "https://web.push.apple.com/y" });
    expect(a).not.toBe(b);
  });
});
