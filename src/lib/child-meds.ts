/**
 * ยาของลูก + กันให้ยาซ้ำ (D2/D3) — ฟังก์ชันล้วน ใช้ทั้ง action และหน้าจอ
 *
 * ⚠️ ไม่มีคำว่า "ให้ได้" หรือ "ห้ามให้" — ขนาดและช่วงห่างของยาเด็กเป็นเรื่องของแพทย์
 *    ทุกอย่างที่ออกจากที่นี่คือข้อเท็จจริง: ใครให้ เมื่อไหร่ ห่างกี่นาที
 *    และช่วงห่างที่ "ผู้ใช้ตั้งเอง" ตามที่แพทย์หรือฉลากบอก
 */
import { secondsBetween } from "./baby-log";

/** ตัวเลือกช่วงห่างของยาตามอาการ (นาที) — ผู้ใช้เลือกตามฉลาก ไม่ใช่ค่าที่แอปแนะนำ */
export const MED_GAPS = [240, 360, 480, 720] as const;
export const MAX_MED_TIMES_CHILD = 4;

export type DoseView = {
  id: string;
  givenAt: string;
  givenBy: string;
  givenByName: string | null;
};

export type ChildMedRule = {
  mode: "prn" | "daily";
  minGapMin: number | null;
  times: string | null;
};

export const parseTimes = (raw: string | null): string[] =>
  (raw ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter((t) => /^([01]\d|2[0-3]):[0-5]\d$/.test(t))
    .sort();

export type DoseWarning = {
  last: DoseView;
  sinceSec: number;
  /** prn: ช่วงห่างที่ตั้งไว้ · daily: null */
  gapMin: number | null;
  /** daily: วันนี้ให้ไปแล้วกี่ครั้ง / ตั้งไว้กี่ครั้ง */
  today?: { given: number; planned: number };
};

/**
 * ควรถามก่อนบันทึกไหม — คืนข้อเท็จจริงไว้แสดง ไม่ได้ห้าม
 *
 * prn: ครั้งล่าสุดยังไม่ถึงช่วงห่างที่ตั้งไว้
 * daily: วันนี้ให้ครบตามจำนวนเวลาที่ตั้งไว้แล้ว
 *
 * `doses` เรียงใหม่สุดก่อน
 */
export function doseWarning(med: ChildMedRule, doses: DoseView[], now: string): DoseWarning | null {
  const last = doses[0];
  if (!last) return null;
  const sinceSec = secondsBetween(last.givenAt, now);
  if (med.mode === "prn") {
    if (!med.minGapMin) return null;
    return sinceSec < med.minGapMin * 60 ? { last, sinceSec, gapMin: med.minGapMin } : null;
  }
  const planned = parseTimes(med.times).length || 1;
  const day = now.slice(0, 10);
  const given = doses.filter((d) => d.givenAt.slice(0, 10) === day).length;
  return given >= planned ? { last, sinceSec, gapMin: null, today: { given, planned } } : null;
}

/** `4 ชม.` · `2.5 ชม.` */
export const gapLabel = (min: number) => {
  const h = min / 60;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} ชม.`;
};

/** บรรทัดรองใต้ชื่อยา */
export function ruleLabel(med: ChildMedRule & { dose: string | null }): string {
  const dose = med.dose ? `ครั้งละ ${med.dose}` : null;
  let how: string;
  if (med.mode === "prn") {
    how = `ให้ตามอาการ${med.minGapMin ? ` · ห่างกันอย่างน้อย ${gapLabel(med.minGapMin)}` : ""}`;
  } else {
    const t = parseTimes(med.times);
    how = t.length <= 1 ? `วันละครั้ง${t[0] ? ` · ${t[0]}` : ""}` : `วันละ ${t.length} ครั้ง · ${t.join(" · ")}`;
  }
  return [dose, how].filter(Boolean).join(" · ");
}

/** ยิงเตือนยาประจำช้าได้นานสุดเท่าไหร่ — ตรงกับเตือนยาของผู้ใหญ่ (LATE_MINUTES) */
export const CHILD_MED_LATE_MIN = 60;
/** ให้ก่อนเวลาไม่เกินเท่านี้ถือว่าเป็นของรอบนี้ (ให้ 08:40 แทน 09:00 ไม่ต้องเตือน) */
export const CHILD_MED_EARLY_MIN = 60;

/**
 * เวลาของยาประจำที่ควรเตือนตอนนี้
 *
 * ถึงเวลาแล้วไม่เกิน CHILD_MED_LATE_MIN นาที และยังไม่มีใครบันทึกว่าให้
 * ตั้งแต่ CHILD_MED_EARLY_MIN นาทีก่อนเวลานั้น — มีคนให้แล้ว ไม่ต้องปลุกคนอื่น
 */
export function dueSlots(times: string | null, givenAts: string[], now: string): string[] {
  const day = now.slice(0, 10);
  const nowMs = Date.parse(`${now}Z`);
  return parseTimes(times).filter((t) => {
    const slot = Date.parse(`${day}T${t}:00Z`);
    if (slot > nowMs || nowMs - slot > CHILD_MED_LATE_MIN * 60_000) return false;
    const from = slot - CHILD_MED_EARLY_MIN * 60_000;
    return !givenAts.some((g) => Date.parse(`${g}Z`) >= from);
  });
}
