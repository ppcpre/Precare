/**
 * เงินเก็บเป็นจำนวนเต็ม "สตางค์" เสมอ ห้ามใช้ float
 *
 * D1 เป็น SQLite ไม่มี DECIMAL ถ้าเก็บเป็น REAL ยอดรวมจะเพี้ยนแบบไล่ไม่เจอ
 * (0.1 + 0.2 !== 0.3) ซึ่งกับเรื่องเงินยอมไม่ได้ ทุกการคำนวณจึงทำบนสตางค์
 * แล้วค่อยแปลงเป็นบาทตอนแสดงผลอย่างเดียว
 */
export const SATANG_PER_BAHT = 100;

/** เพดานกันคนพิมพ์เลขหลุด — 10 ล้านบาทต่อนัดเดียวไม่สมเหตุผล */
export const MAX_COST_SATANG = 10_000_000 * SATANG_PER_BAHT;

/**
 * แปลงข้อความที่ผู้ใช้พิมพ์เป็นสตางค์
 *
 * รับ "1200", "1,200", "1200.50", " 1200 " ได้หมด
 * คืน null เมื่อว่าง (= ยังไม่ได้ระบุ ซึ่งคนละเรื่องกับ 0)
 * คืน undefined เมื่อรูปแบบใช้ไม่ได้ ให้ผู้เรียกตัดสินใจว่าจะฟ้องยังไง
 */
export function parseBaht(input: string): number | null | undefined {
  const raw = input.replace(/[,\s฿]/g, "");
  if (raw === "") return null;
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) return undefined;

  // คูณบนสตริงแทนการคูณ float — Number("0.07") * 100 ได้ 7.000000000000001
  const [baht, frac = ""] = raw.split(".");
  const satang = Number(baht) * SATANG_PER_BAHT + Number(frac.padEnd(2, "0"));
  if (!Number.isSafeInteger(satang) || satang > MAX_COST_SATANG) return undefined;
  return satang;
}

/** 120000 -> "1,200"  ·  120050 -> "1,200.50" — ไม่โชว์ .00 ให้รก */
export function formatBaht(satang: number): string {
  const neg = satang < 0;
  const abs = Math.abs(satang);
  const baht = Math.floor(abs / SATANG_PER_BAHT);
  const frac = abs % SATANG_PER_BAHT;
  const head = baht.toLocaleString("en-US");
  const body = frac === 0 ? head : `${head}.${String(frac).padStart(2, "0")}`;
  return neg ? `-${body}` : body;
}

/** ใส่สัญลักษณ์ให้ด้วย ใช้ตอนแสดงผลทั่วไป */
export const baht = (satang: number) => `฿${formatBaht(satang)}`;
