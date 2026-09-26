/**
 * อ่านหัว Range ตาม RFC 7233 — ใช้ร่วมกันระหว่าง worker เสิร์ฟไฟล์กับ /api/media
 *
 * เคยเขียนแยกกันสองที่แล้วทั้งสองที่รองรับไม่ครบเหมือนกัน คือลืม "suffix range"
 * (`bytes=-500` = ขอ N ไบต์ท้ายไฟล์) แล้วตอบทั้งไฟล์กลับไปพร้อมสถานะ 200
 *
 * ผลคือ **Safari กดเล่นวิดีโอแล้วค้าง** — มันยิง suffix range เพื่อดูท้ายไฟล์
 * ก่อนเริ่มเล่น พอได้สตรีมทั้งก้อนกลับมาแทนไบต์ที่ขอ เครื่องเล่นก็รอต่อไปเรื่อยๆ
 * โดยไม่มี error ให้เห็น (Chrome ไม่ยิงแบบนี้จึงเล่นได้ปกติ ปัญหาเลยโผล่เฉพาะ Safari)
 */
export interface ByteRange {
  start: number;
  end: number;
}

/**
 * คืนช่วงที่ขอ หรือ null เมื่อควรส่งทั้งไฟล์ (ไม่มีหัว Range หรือรูปแบบที่ไม่รองรับ)
 *
 * รองรับสามรูปแบบที่เครื่องเล่นใช้จริง
 *   bytes=<start>-<end>   ช่วงตรงกลาง
 *   bytes=<start>-        ตั้งแต่ตำแหน่งนั้นจนจบไฟล์
 *   bytes=-<n>            n ไบต์สุดท้ายของไฟล์
 *
 * หลายช่วงในคำขอเดียว (`bytes=0-99,200-299`) ไม่รองรับ — ตอบทั้งไฟล์ซึ่งถูกตามสเปก
 * และไม่มีเครื่องเล่นตัวไหนใช้จริง
 */
export function parseRange(header: string | null, size: number): ByteRange | null {
  const raw = header?.trim() ?? "";
  const m = /^bytes=(\d*)-(\d*)$/.exec(raw);
  if (!m) return null;

  const [, rawStart, rawEnd] = m;
  // ไฟล์ว่างไม่มีช่วงไหนให้ตอบได้
  if (size === 0) return null;

  if (rawStart === "") {
    // suffix: bytes=-n · `bytes=-` เฉยๆ ไม่ใช่รูปแบบที่ถูกต้อง
    if (rawEnd === "") return null;
    const n = Number(rawEnd);
    if (n <= 0) return null;
    // ขอท้ายไฟล์มากกว่าขนาดไฟล์ = ได้ทั้งไฟล์ แต่ยังตอบเป็น 206 ตามที่ถูกขอ
    return { start: Math.max(0, size - n), end: size - 1 };
  }

  const start = Number(rawStart);
  const end = rawEnd === "" ? size - 1 : Number(rawEnd);
  // เริ่มเลยขอบไฟล์ = ตอบไม่ได้ ส่งทั้งไฟล์แทนการโยน 416 เพื่อให้เครื่องเล่นเดินต่อได้
  if (start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}
