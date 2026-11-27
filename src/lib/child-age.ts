/**
 * ช่องอายุของสมุดรูปลูก — แรกเกิดถึง 3 ขวบ
 *
 * ⚠️ ทุกอย่างในไฟล์นี้ "คำนวณสด" จากวันเกิดกับวันที่ถ่าย ไม่มีอะไรถูกเก็บลง DB
 *
 * เหตุผล: วันเกิดแก้ได้จริง — พิมพ์ผิด หรือกรอกวันที่กับเวลาสลับกัน ถ้าเก็บ
 * "เดือนที่ 5" ลงไปในแถวรูปตั้งแต่ตอนอัปโหลด พอแก้วันเกิดทีเดียวรูปทั้งอัลบั้ม
 * จะค้างอยู่ช่องเดิมหมดโดยไม่มีใครสังเกต เป็นบั๊กชนิดเดียวกับที่ทำให้อายุครรภ์
 * และ apptDatetime ต้องคำนวณสดทุกครั้ง
 *
 * ความถี่ของช่องไม่เท่ากันตลอด 3 ปี เพราะเด็กเปลี่ยนเร็วมากตอนแรกแล้วช้าลง
 *   แรกเกิด–2 เดือน  รายสัปดาห์   8 ช่อง
 *   2–12 เดือน       รายเดือน    10 ช่อง
 *   1–3 ขวบ          ทุก 3 เดือน  8 ช่อง
 */

/** จำนวนช่องทั้งหมดที่แสดงบน timeline */
export const SLOT_COUNT = 26;

export type SlotKind = "week" | "month" | "quarter";

export interface AgeSlot {
  /** คงที่ตลอดอายุของแอป — ใช้เป็น key ของ React และใน URL ได้ */
  id: string;
  kind: SlotKind;
  /** สัปดาห์ที่เท่าไร (week) หรือ อายุกี่เดือน (month, quarter) */
  n: number;
  label: string;
}

/**
 * บวกเดือนแบบหนีบวันสิ้นเดือน
 *
 * เกิด 31 ม.ค. + 1 เดือน ต้องได้ 28 ก.พ. ไม่ใช่ 3 มี.ค. — `setMonth` ของ JS
 * ม้วนไปเดือนถัดไปเองเงียบๆ ซึ่งจะทำให้เด็กที่เกิดวันที่ 29–31 ข้ามช่องไปทั้งช่อง
 */
export function addMonths(ymd: string, n: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const target = m - 1 + n;
  const ty = y + Math.floor(target / 12);
  const tm = ((target % 12) + 12) % 12;
  /** วันสุดท้ายของเดือนปลายทาง — day 0 ของเดือนถัดไปคือวันสุดท้ายของเดือนนี้ */
  const lastDay = new Date(Date.UTC(ty, tm + 1, 0)).getUTCDate();
  const td = Math.min(d, lastDay);
  const p = (v: number, w = 2) => String(v).padStart(w, "0");
  return `${p(ty, 4)}-${p(tm + 1)}-${p(td)}`;
}

const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);

/** จำนวนวันเต็มระหว่างสองวัน — ลบกันตรงๆ ไม่ผ่าน timezone */
export function daysBetween(fromYmd: string, toYmd: string): number {
  return Math.round((dayMs(toYmd) - dayMs(fromYmd)) / 86_400_000);
}

/**
 * รายการช่องทั้งหมด เรียงจากแรกเกิดไปหา 3 ขวบ
 *
 * สร้างครั้งเดียวตอนโหลดโมดูล ไม่ใช่ทุกครั้งที่เรียก — หน้า timeline วนลิสต์นี้
 * ทุก render และมันไม่เคยเปลี่ยน
 */
export const AGE_SLOTS: readonly AgeSlot[] = Object.freeze([
  ...Array.from({ length: 8 }, (_, i) => ({
    id: `w${i + 1}`,
    kind: "week" as const,
    n: i + 1,
    label: `สัปดาห์ที่ ${i + 1}`,
  })),
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `m${i + 2}`,
    kind: "month" as const,
    n: i + 2,
    label: `${i + 2} เดือน`,
  })),
  ...Array.from({ length: 8 }, (_, i) => {
    const months = 12 + i * 3;
    const years = Math.floor(months / 12);
    const rem = months % 12;
    return {
      id: `q${months}`,
      kind: "quarter" as const,
      n: months,
      label: rem === 0 ? `${years} ขวบ` : `${years} ขวบ ${rem} เดือน`,
    };
  }),
]);

/** ช่องของรูปที่ถ่ายหลัง 3 ขวบ — ไม่ปิดกั้นการอัปโหลด แค่ไม่มีช่องประจำให้ */
export const OVER_SLOT_ID = "over";
export const OVER_SLOT_LABEL = "เกิน 3 ขวบ";

/**
 * วันแรกของแต่ละช่อง (inclusive)
 *
 * ช่องสัปดาห์นับเป็นวัน ช่องเดือนนับเป็นเดือนปฏิทิน — ถ้านับสัปดาห์เป็น 4 สัปดาห์
 * ต่อเดือนจะเพี้ยนสะสมจนถึง 3 ขวบเลื่อนไปเกือบเดือน
 */
export function slotStart(birthDate: string, slot: AgeSlot): string {
  if (slot.kind === "week") {
    const iso = new Date(dayMs(birthDate) + (slot.n - 1) * 7 * 86_400_000);
    return iso.toISOString().slice(0, 10);
  }
  return addMonths(birthDate, slot.n);
}

/**
 * หาว่ารูปที่ถ่ายวันนี้ตกอยู่ช่องไหน
 *
 * คืน null เมื่อถ่ายก่อนวันเกิด — รูปนั้นเป็นของ "ครรภ์" ไม่ใช่ของลูก และต้อง
 * ไม่ถูกดูดเข้าสัปดาห์ที่ 1 เพราะอัลตราซาวด์จะไปปนกับรูปเด็กแรกเกิด
 */
export function slotIdOf(birthDate: string, takenYmd: string): string | null {
  const days = daysBetween(birthDate, takenYmd);
  if (days < 0) return null;

  /** สองเดือนแรกใช้สัปดาห์ — ช่องสุดท้ายยืดไปจนถึงวันครบ 2 เดือนพอดี
   *  ไม่งั้นจะมีช่องว่างระหว่างวันที่ 56 กับวันครบ 2 เดือน (ซึ่งห่างกัน 3–5 วัน) */
  if (takenYmd < addMonths(birthDate, 2)) {
    return `w${Math.min(8, Math.floor(days / 7) + 1)}`;
  }

  if (takenYmd >= addMonths(birthDate, 36)) return OVER_SLOT_ID;

  for (let i = AGE_SLOTS.length - 1; i >= 8; i--) {
    const s = AGE_SLOTS[i];
    if (takenYmd >= addMonths(birthDate, s.n)) return s.id;
  }
  /** ไปถึงตรงนี้ไม่ได้ — เงื่อนไขด้านบนครอบคลุมครบแล้ว กันไว้ให้ type แคบ */
  return "m2";
}

/** อายุแบบที่คนพูดกัน เช่น "3 เดือน 12 วัน" — ใช้บนการ์ดและหัวหน้า timeline */
export function ageLabel(birthDate: string, todayYmd: string): string {
  const days = daysBetween(birthDate, todayYmd);
  if (days < 0) return "ยังไม่เกิด";
  if (days === 0) return "แรกเกิด";
  if (days < 14) return `${days} วัน`;

  let months = 0;
  while (months < 600 && todayYmd >= addMonths(birthDate, months + 1)) months++;

  if (months < 1) return `${Math.floor(days / 7)} สัปดาห์`;
  const rest = daysBetween(addMonths(birthDate, months), todayYmd);
  if (months < 24) {
    return rest === 0 ? `${months} เดือน` : `${months} เดือน ${rest} วัน`;
  }
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem === 0 ? `${years} ขวบ` : `${years} ขวบ ${rem} เดือน`;
}
