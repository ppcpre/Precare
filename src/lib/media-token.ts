/**
 * ตั๋วเข้าถึงไฟล์แบบมีอายุ — ใช้ร่วมกันระหว่างแอปกับ worker เสิร์ฟไฟล์
 *
 * ทำไมต้องมี: เดิมทุกคำขอไฟล์วิ่งเข้า worker ของแอป ซึ่งเป็น Next.js ทั้งก้อน
 * การปลุก isolate ใหม่หนึ่งครั้งกิน CPU 200-250 ms ขณะที่เพดานแพลนฟรีคือ 10 ms
 * เครื่องเล่นวิดีโอยิงคำขอพร้อมกันหลายเส้น จึงปลุก isolate พร้อมกันหลายตัว
 * แล้วได้ Error 1102 (ดู docs/project-plan.md 6.13)
 *
 * worker เสิร์ฟไฟล์ไม่มี session ของ Better Auth และไม่ควรมี — มันต้องเล็ก
 * ตั๋วนี้คือสิ่งที่แทน session: แอปเป็นคนออกให้หลังตรวจสิทธิ์แล้ว
 *
 * ออกเป็น "ตั๋วต่อขอบเขต" ไม่ใช่ "ตั๋วต่อไฟล์" เพราะหน้าอัลบั้มหน้าเดียว
 * มีรูป 30 ใบ การเซ็นทีละใบคือ 30 ครั้งต่อการเปิดหนึ่งหน้า
 */

const enc = new TextEncoder();

/**
 * อายุตั๋ว
 *
 * ตั๋วคือ "ของที่ถืออยู่แล้วเปิดไฟล์ได้" — ใครก๊อป URL ออกไปจากหน้าเว็บ
 * ก็เปิดไฟล์นั้นได้จนกว่าตั๋วจะหมดอายุ แม้จะไม่ได้ล็อกอิน
 * นี่คือราคาที่จ่ายเพื่อย้ายไฟล์ออกไปคนละ origin (คุกกี้ข้าม origin ไม่ไป
 * และ <img> แนบ header เองไม่ได้ จึงผูกกับ session ไม่ได้)
 *
 * 2 ชั่วโมงคือจุดที่รับได้: สั้นพอให้ URL ที่หลุดตายเร็ว
 * และยาวพอให้คนเปิดหน้าค้างไว้แล้วเลื่อนดูต่อไม่เจอรูปพัง
 */
export const MEDIA_TOKEN_TTL_MS = 2 * 60 * 60 * 1000;

/**
 * ปัดเวลาออกตั๋วลงเป็นช่วงละชั่วโมง เพื่อให้ URL เดิมซ้ำได้
 *
 * ถ้าไม่ปัด ทุกครั้งที่ render หน้าใหม่จะได้ exp ใหม่ = URL ใหม่ =
 * แคชในเบราว์เซอร์ใช้ไม่ได้เลย รูปทุกใบถูกโหลดใหม่ทุกครั้งที่เปิดหน้า
 * ซึ่งสวนทางกับเหตุผลทั้งหมดที่แยก worker ตัวนี้ออกมา
 */
const SLOT_MS = 30 * 60 * 1000;

/**
 * ขอบเขตที่ยอมให้ออกตั๋วได้ ต้องลงท้ายด้วย /
 *
 * ถ้าไม่บังคับ / ปิดท้าย ตั๋วของ `family/abc` จะเปิดไฟล์ของ `family/abcdef`
 * ได้ด้วย เพราะ startsWith ผ่าน
 */
const SCOPE = /^(family|user)\/[A-Za-z0-9_-]+\/$/;

function b64url(bytes: ArrayBuffer | Uint8Array) {
  const b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string) {
  const b = atob(s.replace(/-/g, "+").replace(/_/g, "/"));
  const out = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i);
  return out;
}

function hmacKey(secret: string, usage: KeyUsage[]) {
  return crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, usage);
}

/** ขอบเขตของครอบครัว/ผู้ใช้ ในรูปแบบที่ตั๋วรับได้ */
export const familyScope = (familyId: string) => `family/${familyId}/`;
export const userScope = (userId: string) => `user/${userId}/`;

export async function createMediaToken(
  secret: string,
  scope: string,
  now = Date.now(),
  ttlMs = MEDIA_TOKEN_TTL_MS,
) {
  if (!SCOPE.test(scope)) throw new Error("ขอบเขตของตั๋วไม่ถูกต้อง");
  const exp = Math.floor((Math.floor(now / SLOT_MS) * SLOT_MS + ttlMs) / 1000);
  const sig = await crypto.subtle.sign(
    "HMAC",
    await hmacKey(secret, ["sign"]),
    enc.encode(`${scope}|${exp}`),
  );
  return `${b64url(enc.encode(scope))}.${exp}.${b64url(sig)}`;
}

/**
 * ตรวจตั๋วกับ "ไฟล์ที่ขอมาจริง" ไม่ใช่ตรวจแค่ว่าลายเซ็นถูก
 *
 * ถ้าตรวจแค่ลายเซ็น ตั๋วของครอบครัวเราจะเปิดไฟล์ของครอบครัวอื่นได้ทันที
 */
export async function verifyMediaToken(
  secret: string,
  token: string,
  key: string,
  now = Date.now(),
): Promise<boolean> {
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [rawScope, rawExp, sig] = parts;

  let scope: string;
  try {
    scope = new TextDecoder().decode(fromB64url(rawScope));
  } catch {
    return false;
  }
  if (!SCOPE.test(scope) || !key.startsWith(scope)) return false;

  const exp = Number(rawExp);
  if (!Number.isInteger(exp) || exp * 1000 <= now) return false;

  try {
    // ใช้ subtle.verify ไม่ใช่เทียบสตริงเอง — เทียบสตริงรั่วเวลาให้เดาลายเซ็นทีละตัวอักษรได้
    return await crypto.subtle.verify(
      "HMAC",
      await hmacKey(secret, ["verify"]),
      fromB64url(sig),
      enc.encode(`${scope}|${exp}`),
    );
  } catch {
    return false;
  }
}
