/**
 * แปลงข้อมูลดิบให้เป็นสิ่งที่การ์ดน้ำหนักต้องแสดง
 *
 * แยกจาก component เพราะตรรกะตรงนี้คือจุดที่พลาดแล้วหน้าจอจะบอกคนท้องผิด —
 * เช่นบอกว่า "ต่ำกว่าเกณฑ์" ทั้งที่ยังไม่ได้กรอกน้ำหนักก่อนตั้งครรภ์ด้วยซ้ำ
 * หรือเทียบน้ำหนักของสัปดาห์ที่ 10 กับเกณฑ์ของสัปดาห์ปัจจุบัน
 */
import {
  assessGain,
  bandOf,
  bmiOf,
  expectedGainAt,
  isFastGain,
  type BmiBand,
  type GainAssessment,
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
      /** น้ำหนักก่อนตั้งครรภ์ (กก.) — แกนตั้งของกราฟเป็นน้ำหนักจริง จึงต้องรู้จุดเริ่ม */
      prePregnancyWeight: number;
      points: WeightPoint[];
      /** จุดล่าสุด ใช้เทียบกับเกณฑ์ */
      current: WeightPoint;
      expected: { min: number; max: number };
      /** อยู่ในช่วงไหม และถ้าไม่ ห่างแค่ไหน — ขอบของช่วงไม่ใช่เส้นตัดสิน */
      assessment: GainAssessment;
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
    prePregnancyWeight: base,
    points,
    current,
    expected,
    assessment: assessGain(current.gain, band, expected),
    /**
     * เทียบเฉพาะสองครั้งล่าสุด ไม่ใช่ทั้งช่วง — สัญญาณที่สนใจคือ "เพิ่งขึ้นเร็ว"
     * ไม่ใช่ "ขึ้นเยอะมาตลอด" ซึ่งเป็นคนละเรื่องและอ่านได้จากกราฟอยู่แล้ว
     */
    fastGain: prev ? isFastGain(current.gain - prev.gain, current.week - prev.week) : false,
  };
}

/** จำนวนช่องที่อยากได้บนแกนตั้ง — ขอ 6 แล้วปัดขั้นเป็นเลขกลมๆ มักได้ 4–6 ขีด */
const AXIS_GAPS = 6;
/** ตัวคูณที่ยอมให้เป็นระยะห่างของขีด — ไม่มี 2.5 เพราะไม่อยากให้ป้ายมีทศนิยม */
const AXIS_STEPS = [1, 2, 4, 5, 10];

export interface WeightTick {
  /** น้ำหนักจริงที่พิมพ์บนแกน (กก.) */
  kg: number;
  /** ตำแหน่งบนแกนเดียวกับ WeightPoint.gain จึงวาดด้วย yOf ตัวเดียวกันได้ */
  gain: number;
}

/**
 * ขีดของแกนตั้ง — เป็น **น้ำหนักจริง** ไม่ใช่น้ำหนักที่เพิ่ม
 *
 * คนชั่งได้ 58.4 ตอนเช้าแล้วเปิดแอปมา ควรหาตัวเองบนกราฟเจอทันที ไม่ต้องคิด
 * ในใจว่า 0 บนแกนคือน้ำหนักก่อนท้องของตัวเอง ส่วนตัวเลขที่เพิ่มยังอยู่ใน
 * ข้อความใต้กราฟ จึงไม่เสียข้อมูลอะไรไป
 *
 * ขีดเกาะทวีคูณของเลขกลมๆ ไม่ใช่หารช่วงเท่าๆ กัน — ไม่งั้นป้ายจะออกมาเป็น
 * 51.5 / 55.0 / 58.5 ซึ่งอ่านไม่ออกว่าเป็นเลขอะไร
 */
export function weightAxisTicks(
  prePregnancyWeight: number,
  minGain: number,
  maxGain: number,
): WeightTick[] {
  const lo = prePregnancyWeight + minGain;
  const hi = prePregnancyWeight + maxGain;
  if (!(hi > lo)) return [];

  const raw = (hi - lo) / AXIS_GAPS;
  const pow = 10 ** Math.floor(Math.log10(raw));
  // ไม่ต่ำกว่า 1 กก. ป้ายจึงเป็นจำนวนเต็มเสมอ
  const step = Math.max(1, (AXIS_STEPS.find((m) => raw <= m * pow) ?? 10) * pow);

  const ticks: WeightTick[] = [];
  for (let k = Math.ceil(lo / step); k * step <= hi + 1e-9; k++) {
    const kg = Math.round(k * step * 10) / 10;
    ticks.push({ kg, gain: Math.round((kg - prePregnancyWeight) * 10) / 10 });
  }
  return ticks;
}

/** within = ในช่วง · slight = ห่างนิดเดียว · off = ห่างจนควรยกไปคุยกับหมอ */
export type GainToneKind = "within" | "slight" | "off";

export interface GainTone {
  kind: GainToneKind;
  text: string;
  /** คำอธิบายใต้ข้อความหลัก — null เมื่ออยู่ในช่วง ไม่มีอะไรต้องอธิบาย */
  note: string | null;
}

/**
 * ถ้อยคำของแถบสรุป
 *
 * เลี่ยงคำว่า "สูงกว่า/ต่ำกว่าช่วงที่คาดไว้" เพราะอ่านเหมือนตัดสินว่าตัวเอง
 * หนักเกินหรือผอมเกิน ทั้งที่สิ่งที่วัดคือ**จังหวะการขึ้น**เทียบกับตาราง
 * จึงใช้คำว่าขึ้นเร็ว/ขึ้นช้ากว่า และบอกเป็นกิโลเสมอว่าห่างแค่ไหน —
 * คนที่เกิน 0.3 กก. ไม่ควรได้ข้อความเดียวกับคนที่เกิน 3 กก.
 *
 * ทางออกของทุกกรณีคือคุยกับหมอ **ห้ามแนะนำให้คุมอาหารหรือลดน้ำหนักเอง**
 * ระหว่างตั้งครรภ์ — เป็นคำแนะนำทางการแพทย์ที่แอปไม่มีสิทธิ์ให้
 */
export function gainTone(a: GainAssessment): GainTone {
  if (a.status === "within") {
    return { kind: "within", text: "อยู่ในช่วงที่คาดไว้", note: null };
  }

  const up = a.status === "above";

  if (a.slight) {
    return {
      kind: "slight",
      text: up ? `เกินช่วงที่คาดไว้ ${a.offBy} กก.` : `ยังไม่ถึงช่วงที่คาดไว้ ${a.offBy} กก.`,
      note: "ห่างไม่ถึงที่เกณฑ์ให้ขึ้นได้ในหนึ่งสัปดาห์ · ชั่งคนละเวลาก็ต่างกันได้เท่านี้",
    };
  }

  return {
    kind: "off",
    text: up
      ? `ขึ้นเร็วกว่าช่วงที่คาดไว้ ${a.offBy} กก.`
      : `ขึ้นช้ากว่าช่วงที่คาดไว้ ${a.offBy} กก.`,
    note: "ยกไปคุยกับหมอตอนฝากครรภ์ครั้งหน้าได้ ไม่ต้องปรับอาหารเอง",
  };
}
