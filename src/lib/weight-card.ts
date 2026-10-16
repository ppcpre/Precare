/**
 * แปลงข้อมูลดิบให้เป็นสิ่งที่การ์ดน้ำหนักต้องแสดง
 *
 * แยกจาก component เพราะตรรกะตรงนี้คือจุดที่พลาดแล้วหน้าจอจะบอกคนท้องผิด —
 * เช่นบอกว่า "ต่ำกว่าเกณฑ์" ทั้งที่ยังไม่ได้กรอกน้ำหนักก่อนตั้งครรภ์ด้วยซ้ำ
 * หรือเทียบน้ำหนักของสัปดาห์ที่ 10 กับเกณฑ์ของสัปดาห์ปัจจุบัน
 */
import {
  bandOf,
  bmiOf,
  expectedGainAt,
  isFastGain,
  statusOf,
  type BmiBand,
  type GainStatus,
} from "@/lib/weight-gain";

export interface WeightPoint {
  week: number;
  /** น้ำหนักที่เพิ่มจากก่อนตั้งครรภ์ (กก.) ติดลบได้ — ไตรมาสแรกบางคนน้ำหนักลด */
  gain: number;
}

export type WeightCardView =
  /** ยังไม่รู้อายุครรภ์ — การ์ดนี้ไม่มีความหมาย */
  | { state: "no_pregnancy" }
  /** ขาดส่วนสูงหรือน้ำหนักก่อนตั้งครรภ์ จึงยังคำนวณเกณฑ์ไม่ได้ */
  | { state: "need_setup" }
  /** มีเกณฑ์แล้วแต่ยังไม่เคยบันทึกน้ำหนัก */
  | { state: "need_log"; bmi: number; band: BmiBand }
  | {
      state: "ready";
      bmi: number;
      band: BmiBand;
      points: WeightPoint[];
      /** จุดล่าสุด ใช้เทียบกับเกณฑ์ */
      current: WeightPoint;
      expected: { min: number; max: number };
      status: GainStatus;
      /** ขึ้นเร็วผิดปกติระหว่างสองครั้งล่าสุด (เกิน 1 กก./สัปดาห์) */
      fastGain: boolean;
    };

export interface WeightCardInput {
  lmpDate: string | null;
  heightCm: number | null;
  prePregnancyWeight: number | null;
  /** บันทึกสุขภาพทั้งหมด เรียงยังไงก็ได้ — ฟังก์ชันนี้จัดเอง */
  logs: { week: number; weight: number | null }[];
}

export function buildWeightCard(input: WeightCardInput): WeightCardView {
  if (!input.lmpDate) return { state: "no_pregnancy" };

  const bmi = bmiOf(input.prePregnancyWeight, input.heightCm);
  const band = bandOf(bmi);
  // ขาดค่าใดค่าหนึ่งก็คำนวณเกณฑ์ไม่ได้ — ห้ามเดาแทน
  if (bmi == null || band == null) return { state: "need_setup" };

  const base = input.prePregnancyWeight as number;
  const points = input.logs
    .filter((l): l is { week: number; weight: number } => l.weight != null)
    .map((l) => ({ week: l.week, gain: Math.round((l.weight - base) * 10) / 10 }))
    .sort((a, b) => a.week - b.week);

  if (points.length === 0) return { state: "need_log", bmi, band };

  const current = points[points.length - 1];
  const expected = expectedGainAt(band, current.week);
  const prev = points[points.length - 2];

  return {
    state: "ready",
    bmi,
    band,
    points,
    current,
    expected,
    status: statusOf(current.gain, expected),
    /**
     * เทียบเฉพาะสองครั้งล่าสุด ไม่ใช่ทั้งช่วง — สัญญาณที่สนใจคือ "เพิ่งขึ้นเร็ว"
     * ไม่ใช่ "ขึ้นเยอะมาตลอด" ซึ่งเป็นคนละเรื่องและอ่านได้จากกราฟอยู่แล้ว
     */
    fastGain: prev ? isFastGain(current.gain - prev.gain, current.week - prev.week) : false,
  };
}
