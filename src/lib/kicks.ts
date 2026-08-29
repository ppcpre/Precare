/**
 * นับลูกดิ้น — กติกาและการคำนวณ
 *
 * ⚠️ ฟีเจอร์นี้ต่างจากอันอื่นในแอป เพราะ "ลูกดิ้นน้อยลง" เป็นสัญญาณที่ต้อง
 *    ไปโรงพยาบาล ทุกฟังก์ชันในนี้จึงคืน "ข้อเท็จจริง" เท่านั้น
 *    ห้ามมีฟังก์ชันไหนคืนคำว่าปกติ ปลอดภัย หรืออะไรที่เป็นการประเมินสุขภาพ
 *    การตีความเป็นหน้าที่ของแพทย์ ไม่ใช่ของแอป
 *
 * เกณฑ์ที่ใช้: Cardiff count-to-ten — นับให้ครบ 10 ครั้ง จับเวลาว่าใช้เท่าไหร่
 * เป็นวิธีที่โรงพยาบาลไทยสอนมากที่สุดและเข้าใจง่ายที่สุด
 */

/** ครบ 10 ครั้งถือว่าจบรอบ */
export const TARGET_COUNT = 10;

/** เกินเท่านี้ยังไม่ครบ = ตำราแนะนำให้ติดต่อแพทย์ */
export const SLOW_MINUTES = 120;

/** ก่อนสัปดาห์นี้การดิ้นยังไม่เป็นเวลา นับไปก็ตีความไม่ได้ */
export const START_WEEK = 28;

/** กันรอบที่ลืมปิดค้างข้ามคืน — เกินเท่านี้ถือว่าไม่ใช่รอบที่ยังใช้งานอยู่ */
export const STALE_HOURS = 12;

export type KickEvent = { at: string };

/**
 * เวลาท้องถิ่นแบบไม่มี timezone ให้ตรงกับ apptDatetime ของนัดหมาย
 *
 * ⚠️ ต้องเรียกจากฝั่ง client เท่านั้น
 *    worker รันในโซน UTC ถ้าเรียกฝั่งเซิร์ฟเวอร์จะได้เวลา UTC ที่ถูกติดป้าย
 *    ว่าเป็นเวลาท้องถิ่น พอเบราว์เซอร์เอาไปอ่านเป็นเวลาไทยจะเพี้ยนไป 7 ชั่วโมง
 *    (เคยทำให้ตัวจับเวลาขึ้นว่าผ่านไป 7 ชั่วโมงทั้งที่เพิ่งกดเริ่ม)
 *    ทุก action จึงรับเวลามาจาก client ไม่สร้างเอง
 */
export function localIso(d: Date = new Date()): string {
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(
    d.getMinutes(),
  )}:${p(d.getSeconds())}`;
}

export function parseEvents(raw: string): KickEvent[] {
  try {
    const v: unknown = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    // กรองของที่ผิดรูปทิ้ง ดีกว่าปล่อยให้หน้าพังทั้งหน้าเพราะข้อมูลเสียแถวเดียว
    return v.filter(
      (e): e is KickEvent =>
        typeof e === "object" && e !== null && typeof (e as KickEvent).at === "string",
    );
  } catch {
    return [];
  }
}

export const elapsedMs = (startedAt: string, nowMs: number) =>
  Math.max(0, nowMs - new Date(startedAt).getTime());

/** 0:42 · 18:42 · 2:04:10 — ไม่ใส่ชั่วโมงถ้ายังไม่ถึง */
export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const p = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${p(m)}:${p(s)}` : `${m}:${p(s)}`;
}

/**
 * "26 นาที" · "1 ชม. 8 นาที" — สำหรับที่ที่ไม่ต้องละเอียดถึงวินาที
 * ต่ำกว่า 1 นาทีบอกตรงๆ ไม่ปัดเป็น "0 นาที" ซึ่งอ่านแล้วเหมือนระบบพัง
 */
export function formatMinutes(ms: number): string {
  const mins = Math.round(ms / 60000);
  if (mins < 1) return "ไม่ถึง 1 นาที";
  if (mins < 60) return `${mins} นาที`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m === 0 ? `${h} ชม.` : `${h} ชม. ${m} นาที`;
}

export type SessionRow = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  targetCount: number;
  events: string;
  note: string | null;
};

export type SessionView = {
  id: string;
  startedAt: string;
  endedAt: string | null;
  count: number;
  target: number;
  events: KickEvent[];
  /** null เมื่อยังนับอยู่ — ต้องคำนวณจากเวลาปัจจุบันฝั่ง client แทน */
  durationMs: number | null;
  note: string | null;
};

export function toView(row: SessionRow): SessionView {
  const events = parseEvents(row.events);
  return {
    id: row.id,
    startedAt: row.startedAt,
    endedAt: row.endedAt,
    count: events.length,
    target: row.targetCount,
    events,
    durationMs: row.endedAt
      ? Math.max(0, new Date(row.endedAt).getTime() - new Date(row.startedAt).getTime())
      : null,
    note: row.note,
  };
}

/**
 * เกินเวลาที่ตำราใช้เป็นเกณฑ์แล้วหรือยัง
 *
 * คืนแค่ true/false ไม่ได้แปลว่าผิดปกติ — เป็นแค่ข้อเท็จจริงว่าเลยเกณฑ์เวลาแล้ว
 * หน้าที่เรียกใช้ต้องเขียนข้อความเอง และห้ามเขียนในทางกลับกันว่า "ยังไม่เกิน = ปกติ"
 */
export const isOverTimeLimit = (elapsed: number) => elapsed >= SLOW_MINUTES * 60_000;

/**
 * ค่าเฉลี่ยของ "ลูกคนนี้เอง" ไม่ใช่ค่ามาตรฐานของคนอื่น
 * ทารกแต่ละคนมีจังหวะต่างกันมาก การเทียบกับค่ากลางจึงไม่มีความหมาย
 * นับเฉพาะรอบที่ครบเป้า รอบที่หยุดกลางคันเอามาเฉลี่ยไม่ได้
 */
export function averageMs(sessions: readonly SessionView[]): number | null {
  const done = sessions.filter((s) => s.durationMs != null && s.count >= s.target);
  if (done.length === 0) return null;
  return Math.round(done.reduce((sum, s) => sum + s.durationMs!, 0) / done.length);
}

/** รอบที่ช้ากว่าค่าเฉลี่ยของตัวเองมาก — ใช้ชี้ให้ดู ไม่ใช่ตัดสิน */
export const SLOW_VS_AVERAGE = 2;
export function isSlowVsAverage(session: SessionView, avg: number | null): boolean {
  if (avg == null || session.durationMs == null) return false;
  return session.durationMs >= avg * SLOW_VS_AVERAGE;
}
