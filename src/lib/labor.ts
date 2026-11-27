import { localIso } from "@/lib/kicks";

/**
 * จับเวลาการบีบตัวของมดลูก
 *
 * ⚠️ ฟีเจอร์นี้ถูกใช้ตอนตัดสินใจว่า "จะไปโรงพยาบาลไหม" ข้อห้ามจึงเข้มกว่านับลูกดิ้น
 *
 * - **ห้ามเขียนว่า "ยังไม่ต้องไป" หรือ "รอได้"** ไม่ว่าตัวเลขจะเป็นยังไง
 *   ยังไม่เข้าเกณฑ์ไม่ได้แปลว่าไม่ต้องไป มีอาการอื่นอีกหลายอย่างที่ต้องไปทันที
 * - เข้าเกณฑ์แล้วบอกว่า "ตรงกับเกณฑ์ที่ตำราใช้" ไม่ใช่ "ถึงเวลาแล้ว"
 *   คนตัดสินคือหมอ แอปบอกได้แค่ว่าตัวเลขตรงกับอะไร
 */

/**
 * เปิดให้ใช้ตั้งแต่สัปดาห์ 36
 *
 * การบีบตัวเตือน (Braxton Hicks) รู้สึกได้ก่อนหน้านั้น แต่เปิดเร็วเกินไป
 * จะทำให้คนจับเวลาการบีบตัวเตือนแล้วตกใจโดยไม่จำเป็น
 * ก่อนสัปดาห์ 36 ถ้าท้องแข็งถี่ผิดปกติคือเรื่องที่ต้อง **ไปหาหมอ**
 * ไม่ใช่เรื่องที่ต้องมานั่งจับเวลา — หน้าก่อนถึงเวลาจึงต้องพาไปหาหมอ
 */
export const START_WEEK = 36;

/** ปิดรอบที่ลืมทิ้งไว้ — สั้นกว่านับลูกดิ้นเพราะรอบจับเวลาไม่ยาวขนาดนั้น */
export const STALE_HOURS = 8;

/**
 * เกณฑ์ 5-1-1 — บีบทุก 5 นาที ครั้งละ 1 นาที ต่อเนื่อง 1 ชั่วโมง
 *
 * เลือก 5-1-1 เพราะเป็นตัวที่โรงพยาบาลไทยใช้บ่อยที่สุด
 * บางที่ใช้ 4-1-1 สำหรับคนท้องแรก การทำให้ตั้งค่าได้ตามที่หมอสั่งจะถูกกว่า
 * ในแง่ความถูกต้อง แต่เพิ่มความซับซ้อนมาก — ทางออกคือใช้ 5-1-1 เป็นค่าตั้งต้น
 * แล้ว **เขียนกำกับทุกหน้าว่าให้ยึดตามที่หมอบอก**
 */
export const RULE = {
  /** ห่างกันไม่เกินกี่นาที */
  maxGapMinutes: 5,
  /** บีบนานอย่างน้อยกี่วินาที */
  minDurationSeconds: 60,
  /** เป็นแบบนี้ต่อเนื่องกี่นาที */
  sustainedMinutes: 60,
} as const;

/** ดูย้อนหลังกี่ครั้งตอนตัดสินว่าเข้าเกณฑ์ — มากพอให้ต่อเนื่องหนึ่งชั่วโมง */
const WINDOW = 20;

/**
 * หนึ่งครั้งที่บีบ — `to` เป็น null ระหว่างที่ยังบีบอยู่
 * ใช้คอลัมน์ events เดียวกับนับลูกดิ้น ต่างแค่มีเวลาจบเพิ่มมา
 */
export type Contraction = { at: string; to: string | null };

export function parseContractions(raw: string): Contraction[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is { at: string; to?: unknown } => typeof (e as { at?: unknown })?.at === "string")
      .map((e) => ({ at: e.at, to: typeof e.to === "string" ? e.to : null }));
  } catch {
    // แถวที่ JSON เพี้ยนไม่ควรทำให้หน้าล่ม — หน้านี้ถูกเปิดตอนเจ็บท้อง
    return [];
  }
}

const ms = (iso: string) => new Date(iso).getTime();

/** ความนานของการบีบครั้งนั้น — null ถ้ายังบีบอยู่ */
export const durationOf = (c: Contraction) => (c.to ? Math.max(0, ms(c.to) - ms(c.at)) : null);

/** ระยะห่างวัดจาก "เริ่มถึงเริ่ม" ตามที่ตำราใช้ ไม่ใช่จากคลายถึงเริ่ม */
export const gapOf = (prev: Contraction, next: Contraction) => Math.max(0, ms(next.at) - ms(prev.at));

export type RuleCheck = {
  gapOk: boolean;
  durationOk: boolean;
  sustainedOk: boolean;
  /** ค่าจริงที่วัดได้ ใช้แสดงข้างเกณฑ์ให้เห็นว่าห่างแค่ไหน */
  avgGapMs: number | null;
  avgDurationMs: number | null;
  sustainedMs: number;
  met: boolean;
};

/**
 * ตรวจว่าเข้าเกณฑ์หรือยัง
 *
 * ใช้ค่าเฉลี่ยของช่วงท้าย ไม่ใช่ครั้งล่าสุดครั้งเดียว — การบีบครั้งเดียวที่ห่าง
 * 4 นาทีไม่ได้แปลว่าเข้าเกณฑ์ และครั้งเดียวที่ห่าง 7 นาทีก็ไม่ได้แปลว่าหลุดเกณฑ์
 */
export function checkRule(all: Contraction[]): RuleCheck {
  const done = all.filter((c) => c.to != null);
  const recent = done.slice(-WINDOW);

  const gaps: number[] = [];
  for (let i = 1; i < recent.length; i++) gaps.push(gapOf(recent[i - 1], recent[i]));
  const durations = recent.map(durationOf).filter((d): d is number => d != null);

  const avgGapMs = gaps.length ? Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length) : null;
  const avgDurationMs = durations.length
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : null;

  // ต่อเนื่องมานานแค่ไหน วัดจากครั้งแรกของช่วงที่ดูถึงครั้งล่าสุด
  const sustainedMs =
    recent.length >= 2 ? Math.max(0, ms(recent[recent.length - 1].at) - ms(recent[0].at)) : 0;

  const gapOk = avgGapMs != null && avgGapMs <= RULE.maxGapMinutes * 60_000;
  const durationOk = avgDurationMs != null && avgDurationMs >= RULE.minDurationSeconds * 1000;
  const sustainedOk = sustainedMs >= RULE.sustainedMinutes * 60_000;

  return {
    gapOk,
    durationOk,
    sustainedOk,
    avgGapMs,
    avgDurationMs,
    sustainedMs,
    met: gapOk && durationOk && sustainedOk,
  };
}

/** 4:10 — ระยะห่างและความนานอ่านเป็น นาที:วินาที เสมอ */
export function clock(ms_: number) {
  const total = Math.round(ms_ / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}

/** 52 วิ / 1:05 — ความนานของการบีบสั้นกว่าหนึ่งนาทีบ่อย จึงอ่านเป็นวินาทีล้วนได้ */
export function seconds(ms_: number) {
  const s = Math.round(ms_ / 1000);
  return s < 60 ? `${s} วิ` : clock(ms_);
}

export type LaborSessionView = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  contractions: Contraction[];
  /** ครั้งที่กำลังบีบอยู่ — null ถ้าไม่ได้บีบอยู่ */
  ongoing: Contraction | null;
  count: number;
  durationMs: number | null;
};

export function toLaborView(row: {
  id: string;
  startedAt: string;
  endedAt: string | null;
  events: string;
}): LaborSessionView {
  const contractions = parseContractions(row.events);
  const last = contractions.at(-1) ?? null;
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    contractions,
    ongoing: last && last.to == null ? last : null,
    count: contractions.filter((c) => c.to != null).length,
    durationMs: row.endedAt ? Math.max(0, ms(row.endedAt) - ms(row.startedAt)) : null,
  };
}

/** เวลาท้องถิ่นแบบไม่มี timezone — ใช้ตัวเดียวกับนับลูกดิ้น */
export { localIso };
