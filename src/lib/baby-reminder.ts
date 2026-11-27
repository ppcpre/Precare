/**
 * การแจ้งเตือนของบันทึกลูก — กติกาล้วน ใช้ทั้งหน้าจอ (บอก "อีก 35 นาที")
 * และ cron (ตัดสินว่ายิงหรือยัง) จะได้ไม่คิดคนละแบบ
 *
 * "เตือนเมื่อผ่านไป X ชม. นับจากครั้งล่าสุด" ไม่ใช่เวลาตายตัว
 * บันทึกใหม่เมื่อไหร่ เวลาเตือนเลื่อนตามเอง ไม่ต้องตั้งใหม่
 *
 * เวลาทุกตัวเป็นเวลาท้องถิ่นแบบไม่มี timezone เหมือน baby_logs
 */
import type { BabyLogKind } from "@/db/schema";
import { addSeconds, secondsBetween, sinceAnchor, type BabyLogView } from "./baby-log";

/** ตัวเลือกในฟอร์ม (นาที) — ตามดีไซน์ C3 */
export const REMIND_EVERY = [120, 150, 180, 240] as const;

/** ค่าเริ่มของแต่ละประเภท — ผ้าอ้อมถี่กว่าเรื่องอื่น */
export const REMIND_DEFAULT_EVERY: Record<BabyLogKind, number> = {
  breast: 180,
  bottle: 180,
  diaper: 120,
  sleep: 120,
  pump: 180,
  bath: 240,
};

/** ชื่อบนการ์ดและบนการแจ้งเตือน — เป็นสิ่งที่ต้องทำ ไม่ใช่ชื่อประเภท */
export const REMIND_TITLE: Record<BabyLogKind, string> = {
  breast: "ให้นมเต้า",
  bottle: "ให้นมขวด",
  diaper: "เปลี่ยนผ้าอ้อม",
  sleep: "พาเข้านอน",
  pump: "ปั๊มนม",
  bath: "อาบน้ำ",
};

/**
 * ยิงช้าได้นานสุดเท่าไหร่หลังถึงเวลา — cron รันทุก 5 นาที พลาดได้บ้าง
 * เลยกว่านี้ถือว่าหมดความหมาย (เช่นตั้งเตือนตอนที่ครั้งล่าสุดผ่านไปห้าชั่วโมงแล้ว
 * ไม่ควรเด้งทันทีที่กดบันทึก) จดว่าจัดการแล้วแต่ไม่ยิง
 */
export const REMIND_LATE_MIN = 60;

export type ReminderRule = {
  everyMin: number;
  quietFrom: string | null;
  quietTo: string | null;
};

const isHm = (v: string | null): v is string => !!v && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);

/** มีช่วงงดเตือนจริงไหม — ช่วงที่เริ่มกับจบเท่ากันถือว่าไม่มี */
export const hasQuiet = (r: Pick<ReminderRule, "quietFrom" | "quietTo">) =>
  isHm(r.quietFrom) && isHm(r.quietTo) && r.quietFrom !== r.quietTo;

/** `hm` อยู่ในช่วงงดเตือนไหม — ช่วงข้ามเที่ยงคืนได้ (23:00–07:00) */
export function inQuiet(hm: string, from: string, to: string): boolean {
  return from < to ? hm >= from && hm < to : hm >= from || hm < to;
}

/**
 * ถ้าครบกำหนดในช่วงงดเตือน เลื่อนไปตอนจบช่วงนั้น "ครั้งเดียว"
 */
export function pushOutOfQuiet(at: string, rule: ReminderRule): string {
  if (!hasQuiet(rule)) return at;
  const from = rule.quietFrom!;
  const to = rule.quietTo!;
  const hm = at.slice(11, 16);
  if (!inQuiet(hm, from, to)) return at;
  const day = at.slice(0, 10);
  // ช่วงข้ามเที่ยงคืนและตอนนี้ยังอยู่ฝั่งก่อนเที่ยงคืน → จบช่วงคือพรุ่งนี้
  const endDay = from > to && hm >= from ? addSeconds(`${day}T00:00:00`, 86_400).slice(0, 10) : day;
  return `${endDay}T${to}:00`;
}

export type ReminderState =
  | { status: "off" }
  | { status: "no-log" }
  | { status: "running" }
  | { status: "due"; anchor: string; at: string; shifted: boolean };

/**
 * สถานะของการแจ้งเตือนหนึ่งตัว จากบันทึกล่าสุดของประเภทนั้น
 *
 * - ยังไม่เคยบันทึก = ยังไม่มีอะไรให้นับ (ไม่เดาเวลาเริ่ม)
 * - กำลังจับเวลาอยู่ (ให้นม/นอนค้าง) = ไม่เตือน เพราะกำลังทำอยู่
 * - นอนนับจากตอนตื่น ตรงกับ "ผ่านไป" บนปุ่มกดด่วน
 */
export function reminderState(
  active: boolean,
  latest: Pick<BabyLogView, "kind" | "startedAt" | "endedAt"> | null | undefined,
  rule: ReminderRule,
): ReminderState {
  if (!active) return { status: "off" };
  if (!latest) return { status: "no-log" };
  if (latest.endedAt === null) return { status: "running" };
  const anchor = sinceAnchor(latest as BabyLogView);
  const raw = addSeconds(anchor, rule.everyMin * 60);
  const at = pushOutOfQuiet(raw, rule);
  return { status: "due", anchor, at, shifted: at !== raw };
}

export type CronDecision = "wait" | "send" | "skip";

/**
 * cron ควรทำอะไรกับตัวนี้ตอนนี้
 *
 * send = ถึงเวลาแล้วและยังไม่เคยเตือนจากบันทึกนี้
 * skip = เลยเวลามานานเกินไป จดว่าจัดการแล้วโดยไม่ยิง
 * wait = ยังไม่ถึง หรือเตือนจากบันทึกนี้ไปแล้ว
 */
export function cronDecision(state: ReminderState, lastAnchor: string | null, now: string): CronDecision {
  if (state.status !== "due") return "wait";
  if (lastAnchor === state.anchor) return "wait";
  // เทียบสตริงตรงๆ — secondsBetween ปัดค่าติดลบเป็น 0 จึงบอก "ยังไม่ถึง" ไม่ได้
  if (now < state.at) return "wait";
  return secondsBetween(state.at, now) > REMIND_LATE_MIN * 60 ? "skip" : "send";
}

/** `ทุก 3 ชม.` · `ทุก 2.5 ชม.` */
export function everyLabel(min: number): string {
  const h = min / 60;
  return `ทุก ${Number.isInteger(h) ? h : h.toFixed(1)} ชม.`;
}

/** ปุ่มในฟอร์ม — `2.5 ชม.` */
export const hoursLabel = (min: number) => everyLabel(min).replace("ทุก ", "");
