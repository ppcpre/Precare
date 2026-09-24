/**
 * Web Push — ฝั่งส่ง
 *
 * ทำไมเขียนเอง ไม่ใช้ไลบรารี `web-push`: ตัวนั้นเขียนสำหรับ Node
 * (ใช้ `crypto` กับ `https` ของ Node ตรงๆ) รันบน Workers ไม่ได้
 * และลากของที่เราไม่ต้องการเข้า bundle ที่มีเพดาน 3 MiB
 *
 * ⚠️ ส่งแบบ **ไม่มี payload** โดยตั้งใจ
 *
 * การใส่เนื้อหาลงใน push ต้องเข้ารหัสตาม RFC 8291 (aes128gcm + ECDH)
 * ซึ่งซับซ้อนกว่านี้มาก และที่สำคัญกว่า: **เนื้อหาจะวิ่งผ่านเซิร์ฟเวอร์ push
 * ของ Google/Apple** ข้อความอย่าง "ตรวจครรภ์ 09:30 ที่ รพ.ก" คือข้อมูลสุขภาพ
 * จึงไม่ควรฝากไว้กับใครแม้จะเข้ารหัสแล้ว
 *
 * push ที่ไม่มี payload บอกแค่ว่า "มีอะไรใหม่" แล้ว service worker
 * ค่อยดึงรายละเอียดจากเซิร์ฟเวอร์ของเราเองด้วย cookie ของผู้ใช้
 */

const b64urlToBytes = (s: string) => {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=");
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
};

const bytesToB64url = (b: Uint8Array) =>
  btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

const textToB64url = (s: string) => bytesToB64url(new TextEncoder().encode(s));

/**
 * ประกอบกุญแจสำหรับเซ็นจากคู่คีย์ VAPID
 *
 * `web-push generate-vapid-keys` ให้ public เป็นจุดบนเส้นโค้งแบบไม่บีบอัด 65 ไบต์
 * (ขึ้นต้นด้วย 0x04 แล้วตามด้วย x 32 ไบต์ และ y 32 ไบต์) ส่วน private เป็น d 32 ไบต์
 * WebCrypto รับเป็น JWK จึงต้องแยก x กับ y ออกมาจาก public key
 */
export async function importVapidKey(publicKey: string, privateKey: string) {
  const pub = b64urlToBytes(publicKey);
  if (pub.length !== 65 || pub[0] !== 0x04) {
    throw new Error("VAPID public key ไม่ใช่จุดบนเส้นโค้งแบบไม่บีบอัด 65 ไบต์");
  }
  const jwk: JsonWebKey = {
    kty: "EC",
    crv: "P-256",
    x: bytesToB64url(pub.subarray(1, 33)),
    y: bytesToB64url(pub.subarray(33, 65)),
    d: bytesToB64url(b64urlToBytes(privateKey)),
    ext: true,
    key_ops: ["sign"],
  };
  return crypto.subtle.importKey("jwk", jwk, { name: "ECDSA", namedCurve: "P-256" }, false, [
    "sign",
  ]);
}

/**
 * JWT ตามสเปก VAPID (RFC 8292)
 *
 * aud ต้องเป็น "origin ของเซิร์ฟเวอร์ push" ไม่ใช่ URL เต็มของ endpoint
 * ถ้าใส่ผิดจะได้ 401 กลับมาโดยไม่มีคำอธิบาย
 */
export async function vapidAuthHeader(opts: {
  endpoint: string;
  publicKey: string;
  privateKey: string;
  subject: string;
  now?: number;
}) {
  const aud = new URL(opts.endpoint).origin;
  const nowSec = Math.floor((opts.now ?? Date.now()) / 1000);
  const header = textToB64url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  // 12 ชั่วโมง — สเปกกำหนดไม่เกิน 24 ชั่วโมง
  const body = textToB64url(
    JSON.stringify({ aud, exp: nowSec + 12 * 60 * 60, sub: opts.subject }),
  );
  const signingInput = `${header}.${body}`;

  const key = await importVapidKey(opts.publicKey, opts.privateKey);
  const sig = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    key,
    new TextEncoder().encode(signingInput),
  );
  // ECDSA ของ WebCrypto คืน r||s ดิบ 64 ไบต์ ซึ่งตรงกับที่ JWS ต้องการพอดี
  const jwt = `${signingInput}.${bytesToB64url(new Uint8Array(sig))}`;
  return `vapid t=${jwt}, k=${opts.publicKey}`;
}

export type PushResult = { ok: true } | { ok: false; gone: boolean; status: number };

/**
 * ส่ง push หนึ่งใบ
 *
 * 404/410 = ผู้ใช้ถอนการติดตั้งหรือล้างข้อมูลเบราว์เซอร์ไปแล้ว
 * ต้องลบ subscription ทิ้ง ไม่งั้นจะยิงไปที่ตายแล้วทุกครั้งตลอดไป
 */
export async function sendPush(opts: {
  endpoint: string;
  publicKey: string;
  privateKey: string;
  subject: string;
  ttlSeconds?: number;
}): Promise<PushResult> {
  const res = await fetch(opts.endpoint, {
    method: "POST",
    headers: {
      Authorization: await vapidAuthHeader(opts),
      TTL: String(opts.ttlSeconds ?? 3600),
      // ไม่มีเนื้อหา — ดูเหตุผลด้านบน
      "Content-Length": "0",
      Urgency: "normal",
    },
  });
  if (res.ok) return { ok: true };
  return { ok: false, gone: res.status === 404 || res.status === 410, status: res.status };
}
