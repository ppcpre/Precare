/**
 * ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
 *
 * ตัวชี้ขาดว่าโควตา 5 GB จะพอไหม: รูปมือถือใบละ 3–5 MB ถ้าส่งดิบ
 * 5 GB หมดใน ~1,000 รูป แต่ย่อแล้วเหลือ 80–200 KB รับได้เป็นหมื่นรูป
 */
export async function resizeToWebp(file: File, maxEdge: number, quality = 0.85): Promise<Blob> {
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

  const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, "image/webp", quality));
  if (!blob) throw new Error("ย่อรูปไม่สำเร็จ");
  return blob;
}

export const AVATAR_EDGE = 512;
/** รูปอัลบั้มใหญ่กว่า avatar เพราะต้องดูเต็มจอได้ แต่ยังไม่ถึงขนาดต้นฉบับ */
export const PHOTO_EDGE = 1600;

export const formatBytesShort = (n: number) =>
  n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
