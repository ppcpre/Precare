/**
 * วัดไข้ลูก (D4) — ฟังก์ชันล้วน
 *
 * ⚠️ ไม่มีเกณฑ์ "มีไข้" เป็นตัวเลข — รอแพทย์ตรวจถ้อยคำ
 *    การ์ดเตือนของลูกวัยแรกเกิดใช้ข้อความจาก src/data/danger-signs.ts (WHO IMNCI)
 *    คำต่อคำ ไม่แต่งเพิ่ม และขึ้นตามอายุ ไม่ใช่ตามตัวเลขที่วัดได้
 */
import { DANGER_GROUPS, type DangerSection } from "@/data/danger-signs";
import { addMonths } from "./child-age";

export const TEMP_SITE_LABEL = {
  armpit: "รักแร้",
  ear: "หู",
  forehead: "หน้าผาก",
  rectal: "ทวาร",
} as const;
export type TempSite = keyof typeof TEMP_SITE_LABEL;

/** อาการที่ให้เลือก — ชิปตามดีไซน์ D4 พิมพ์เพิ่มเองได้ */
export const TEMP_SYMPTOMS = ["ดูดนมน้อยลง", "ซึม", "ร้องไม่หยุด", "ผื่น", "อาเจียน"] as const;

/** ช่วงที่เครื่องวัดอ่านได้จริง — กันพิมพ์ผิด ไม่ใช่เกณฑ์ทางการแพทย์ */
export const TEMP_MIN_TENTHS = 340;
export const TEMP_MAX_TENTHS = 430;

export const tempLabel = (tenths: number) => `${(tenths / 10).toFixed(1)} °C`;

/**
 * หมวด "แรกเกิด – 2 เดือน" ของหน้าอาการ — ใช้ตัวเดียวกับที่หน้า /danger/child แสดง
 * ถ้าวันหนึ่งข้อความในหน้านั้นเปลี่ยน การ์ดนี้เปลี่ยนตาม ไม่มีสองฉบับ
 */
export function newbornSection(): DangerSection {
  const s = DANGER_GROUPS.find((g) => g.id === "child")?.sections.find((x) => x.id === "newborn");
  if (!s) throw new Error("danger-signs: ไม่พบหมวด newborn");
  return s;
}

/** อายุยังไม่ถึง 2 เดือน — ตามขอบของหมวดในหน้าอาการ */
export const isYoungInfant = (birthDate: string, today: string) => addMonths(birthDate, 2) > today;

/** อาการที่เลือก → ข้อในหน้าอาการที่ตรงกัน (เฉพาะที่ตรงกันจริง ไม่เดา) */
const SYMPTOM_TO_SIGN: Record<string, string> = {
  ดูดนมน้อยลง: "feed",
  ซึม: "floppy",
};

/**
 * ข้อของหน้าอาการที่จะยกมาบนการ์ด — ข้อตัวร้อน/ตัวเย็นเสมอ เพราะคนเปิดหน้านี้เพื่อวัดไข้
 * บวกข้อที่ตรงกับอาการที่เลือก
 */
export function newbornSignsFor(symptoms: string[]): string[] {
  const section = newbornSection();
  const ids = ["temp", ...symptoms.map((s) => SYMPTOM_TO_SIGN[s]).filter(Boolean)];
  return section.signs.filter((s) => ids.includes(s.id)).map((s) => s.label);
}

/** ตารางให้หน้าจอใช้ — ข้อพื้นฐาน + อาการที่เลือก → ข้อในหน้าอาการ */
export function newbornSignTable(): { base: string[]; bySymptom: Record<string, string> } {
  const section = newbornSection();
  const label = (id: string) => section.signs.find((s) => s.id === id)?.label;
  const bySymptom: Record<string, string> = {};
  for (const [sym, id] of Object.entries(SYMPTOM_TO_SIGN)) {
    const l = label(id);
    if (l) bySymptom[sym] = l;
  }
  return { base: [label("temp")].filter((x): x is string => !!x), bySymptom };
}
