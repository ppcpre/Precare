/**
 * ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
 *
 * ตัวชี้ขาดว่าโควตา 5 GB จะพอไหม: รูปมือถือใบละ 3–5 MB ถ้าส่งดิบ
 * 5 GB หมดใน ~1,000 รูป แต่ย่อแล้วเหลือ 80–200 KB รับได้เป็นหมื่นรูป
 */
/**
 * เข้ารหัส canvas เป็นไฟล์ — เลือกนามสกุลที่เบราว์เซอร์นี้ทำได้จริง
 *
 * **Safari เข้ารหัส webp ไม่ได้** `canvas.toBlob(res, "image/webp")` ไม่ได้คืน
 * null หรือโยน error แต่คืน **PNG** มาเงียบๆ ผลคือรูปจากกล้อง iPhone ที่ควร
 * ย่อเหลือ ~200 KB กลายเป็น PNG หลายเมกะไบต์ต่อใบ แล้วอัปโหลดพังบนเน็ตมือถือ
 * (เจอจริง 14 ต.ค. 69 — อัปจาก Mac ได้ จาก iPhone ไม่ได้ และเทสต์ทั้งชุดรันบน
 * Chromium อย่างเดียวจึงไม่เคยจับได้)
 *
 * เช็คจาก `blob.type` ที่ได้จริง ไม่ใช่เดาจาก userAgent — ถามของจริงเสมอ
 * ตกไปใช้ jpeg ซึ่ง Safari เข้ารหัสได้และเล็กกว่า PNG สิบเท่าสำหรับภาพถ่าย
 */
export async function encodeImage(
  canvas: HTMLCanvasElement,
  quality: number,
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const toBlob = (type: string) =>
    new Promise<Blob | null>((res) => canvas.toBlob(res, type, quality));

  const webp = await toBlob("image/webp");
  if (webp?.type === "image/webp") return { blob: webp, ext: "webp" };

  const jpeg = await toBlob("image/jpeg");
  if (jpeg?.type === "image/jpeg") return { blob: jpeg, ext: "jpg" };

  // เบราว์เซอร์เข้ารหัสอะไรไม่ได้เลย — ยอมใช้ของที่ได้มา ดีกว่าอัปไม่ได้เลย
  if (webp) return { blob: webp, ext: webp.type === "image/png" ? "jpg" : "webp" };
  throw new Error("ย่อรูปไม่สำเร็จ");
}

export async function resizeToWebp(file: File, maxEdge: number, quality = 0.85): Promise<Blob> {
  return (await resizeImage(file, maxEdge, quality)).blob;
}

/** ย่อรูปแล้วบอกด้วยว่าได้ไฟล์ชนิดไหนมาจริง — ผู้เรียกต้องตั้งชื่อไฟล์ให้ตรง */
export async function resizeImage(
  file: File,
  maxEdge: number,
  quality = 0.85,
): Promise<{ blob: Blob; ext: "webp" | "jpg" }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการย่อรูป");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  return encodeImage(canvas, quality);
}

export const AVATAR_EDGE = 512;
/** รูปอัลบั้มใหญ่กว่า avatar เพราะต้องดูเต็มจอได้ แต่ยังไม่ถึงขนาดต้นฉบับ */
export const PHOTO_EDGE = 1600;

export const formatBytesShort = (n: number) =>
  n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
