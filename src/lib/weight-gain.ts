/**
 * เกณฑ์น้ำหนักที่ควรเพิ่มระหว่างตั้งครรภ์ (IOM 2009, ครรภ์เดี่ยว)
 *
 * ⚠️ เป็นค่าอ้างอิง ไม่ใช่คำวินิจฉัย และ**ใช้กับครรภ์เดี่ยวเท่านั้น** ครรภ์แฝด
 * มีเกณฑ์คนละชุดซึ่งเรายังไม่รู้ว่าผู้ใช้ท้องแฝดหรือไม่ จึงต้องเขียนบอกบนหน้าจอ
 *
 * ตัวเลขทั้งหมดมาจากตาราง IOM 2009 ที่ใช้อ้างอิงกันทั่วโลก
 * ก่อนเปิดให้คนนอกใช้ ควรให้บุคลากรทางการแพทย์ตรวจทั้งตัวเลขและถ้อยคำอีกรอบ
 */

export type BmiBand = "under" | "normal" | "over" | "obese";

export interface GainRange {
  /** กิโลกรัมที่ควรเพิ่มตลอดการตั้งครรภ์ */
  totalMin: number;
  totalMax: number;
  /** อัตราต่อสัปดาห์ในไตรมาส 2–3 */
  weeklyMin: number;
  weeklyMax: number;
}

export const BAND_LABEL: Record<BmiBand, string> = {
  under: "ต่ำกว่าเกณฑ์",
  normal: "เกณฑ์ปกติ",
  over: "น้ำหนักเกิน",
  obese: "อ้วน",
};

/**
 * ช่วงของไตรมาสแรกเป็นก้อนเดียว 0.5–2 กก. ทุกกลุ่ม ตามที่ IOM ใช้คำนวณ
 * อัตราต่อสัปดาห์ของไตรมาส 2–3 — ไม่ได้แยกตามกลุ่ม เพราะเป็นสมมติฐานร่วม
 */
export const FIRST_TRIMESTER_MIN = 0.5;
export const FIRST_TRIMESTER_MAX = 2;
/** ไตรมาสแรกนับถึงสิ้นสัปดาห์ที่ 13 */
export const FIRST_TRIMESTER_WEEKS = 13;

const RANGES: Record<BmiBand, GainRange> = {
  under: { totalMin: 12.5, totalMax: 18, weeklyMin: 0.44, weeklyMax: 0.58 },
  normal: { totalMin: 11.5, totalMax: 16, weeklyMin: 0.35, weeklyMax: 0.5 },
  over: { totalMin: 7, totalMax: 11.5, weeklyMin: 0.23, weeklyMax: 0.33 },
  obese: { totalMin: 5, totalMax: 9, weeklyMin: 0.17, weeklyMax: 0.27 },
};

/** BMI = กก. / เมตร² — คืน null ถ้าค่าที่ให้มาไม่สมเหตุสมผล */
export function bmiOf(
  weightKg: number | null,
  heightCm: number | null,
): number | null {
  if (!weightKg || !heightCm) return null;
  if (weightKg < 25 || weightKg > 300) return null;
  if (heightCm < 120 || heightCm > 230) return null;
  /**
   * คิดจากเซนติเมตรตรงๆ ไม่แปลงเป็นเมตรก่อน
   *
   * `80 / (160/100)²` ได้ 31.249999999999996 แล้วปัดเป็น 31.2 ทั้งที่คำตอบจริง
   * คือ 31.25 → 31.3 เพราะ 1.6² ปัดเศษไปแล้วตั้งแต่ก่อนหาร
   * ส่วน `80 * 10000 / 160²` ได้ 31.25 พอดีเป๊ะ เพราะทุกตัวเป็นจำนวนเต็ม
   */
  return Math.round(((weightKg * 10000) / (heightCm * heightCm)) * 10) / 10;
}

export function bandOf(bmi: number | null): BmiBand | null {
  if (bmi == null) return null;
  if (bmi < 18.5) return "under";
  if (bmi < 25) return "normal";
  if (bmi < 30) return "over";
  return "obese";
}

export const rangeOf = (band: BmiBand): GainRange => RANGES[band];

/**
 * ช่วงน้ำหนักที่ควรเพิ่ม "ณ สัปดาห์ที่ n"
 *
 * ไตรมาสแรกบวกเป็นก้อน หลังจากนั้นบวกตามอัตราต่อสัปดาห์ — ไม่ใช่การเฉลี่ย
 * เส้นตรงจาก 0 ถึงน้ำหนักรวม เพราะไตรมาสแรกน้ำหนักแทบไม่ขึ้น การลากเส้นตรง
 * จะทำให้คนไตรมาสแรกเห็นว่าตัวเอง "ต่ำกว่าเกณฑ์" ทั้งที่ปกติดี
 */
export function expectedGainAt(
  band: BmiBand,
  week: number,
): { min: number; max: number } {
  const r = RANGES[band];
  const w = Math.max(0, Math.min(42, week));
  const round = (n: number) => Math.round(n * 10) / 10;

  if (w <= FIRST_TRIMESTER_WEEKS) {
    // ค่อยๆ ขึ้นภายในไตรมาสแรก ไม่ใช่กระโดดเต็มก้อนตั้งแต่สัปดาห์แรก
    const part = w / FIRST_TRIMESTER_WEEKS;
    return {
      min: round(FIRST_TRIMESTER_MIN * part),
      max: round(FIRST_TRIMESTER_MAX * part),
    };
  }

  const after = w - FIRST_TRIMESTER_WEEKS;
  return {
    min: round(FIRST_TRIMESTER_MIN + r.weeklyMin * after),
    max: round(FIRST_TRIMESTER_MAX + r.weeklyMax * after),
  };
}

export type GainStatus = "below" | "within" | "above";

export function statusOf(
  gain: number,
  range: { min: number; max: number },
): GainStatus {
  if (gain < range.min) return "below";
  if (gain > range.max) return "above";
  return "within";
}

/**
 * น้ำหนักขึ้นเร็วผิดปกติในสัปดาห์เดียว
 *
 * เกิน 1 กก./สัปดาห์ เป็นสัญญาณหนึ่งของครรภ์เป็นพิษ **แต่สาเหตุธรรมดาก็มีมาก**
 * (กินเค็ม นั่งนาน ชั่งคนละเวลา) หน้าจอจึงต้องผูกกับอาการอื่นเสมอ
 * ห้ามขึ้นคำเตือนน่ากลัวจากตัวเลขเดียว — คนท้องอ่านแล้วกังวลง่าย
 */
export const FAST_GAIN_KG_PER_WEEK = 1;

export function isFastGain(deltaKg: number, weeksApart: number): boolean {
  if (weeksApart <= 0) return false;
  return deltaKg / weeksApart > FAST_GAIN_KG_PER_WEEK;
}
