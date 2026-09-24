/**
 * กุญแจเซ็นตั๋วไฟล์ — สร้างเองครั้งแรกที่ต้องใช้ แล้วเก็บใน D1
 *
 * ทั้งแอปและ worker เสิร์ฟไฟล์เรียกฟังก์ชันนี้ตัวเดียวกัน จึงไม่มีทาง
 * ตั้งค่าคนละค่ากันได้ (ซึ่งจะทำให้ลิงก์ทุกอันพังแบบหาสาเหตุยาก)
 *
 * ใช้ D1 ดิบ ไม่ผ่าน drizzle เพื่อให้ worker ตัวเล็กไม่ต้องลาก ORM เข้าไปด้วย
 */
const NAME = "media_signing_key";
/** เก็บไว้ในหน่วยความจำของ isolate — ไม่งั้นทุกคำขอไฟล์ต้องอ่าน D1 หนึ่งครั้ง */
let cached: { value: string; at: number } | null = null;
const CACHE_MS = 10 * 60 * 1000;

function randomKey() {
  const b = crypto.getRandomValues(new Uint8Array(32));
  let s = "";
  for (const byte of b) s += String.fromCharCode(byte);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function getMediaSecret(db: D1Database, now = Date.now()): Promise<string> {
  if (cached && now - cached.at < CACHE_MS) return cached.value;

  const read = () =>
    db.prepare("SELECT value FROM app_secrets WHERE name = ?").bind(NAME).first<{ value: string }>();

  let row = await read();
  if (!row) {
    // INSERT OR IGNORE + อ่านซ้ำ — สองคำขอแรกที่มาพร้อมกันจะไม่ได้คนละกุญแจ
    await db
      .prepare("INSERT OR IGNORE INTO app_secrets (name, value) VALUES (?, ?)")
      .bind(NAME, randomKey())
      .run();
    row = await read();
  }
  if (!row) throw new Error("สร้างกุญแจเซ็นลิงก์ไฟล์ไม่สำเร็จ");

  cached = { value: row.value, at: now };
  return row.value;
}

/** สำหรับเทสต์เท่านั้น — isolate เดียวกันถูกใช้ซ้ำข้ามเคส */
export function resetMediaSecretCache() {
  cached = null;
}
