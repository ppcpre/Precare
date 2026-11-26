/**
 * คำนวณของบันทึกประจำวันลูก — ฟังก์ชันล้วน ใช้ได้ทั้ง server และ client
 *
 * เวลาทุกค่าเป็น `YYYY-MM-DDTHH:MM:SS` แบบไม่มี timezone (ดู src/lib/local-time.ts)
 * การลบเวลากันจึงแปลงเป็น UTC ทั้งคู่ — ผลต่างถูกต้องโดยไม่ต้องรู้โซน
 *
 * ⚠️ ห้ามเพิ่มเกณฑ์ "น้อยไป/มากไป" ในไฟล์นี้จนกว่าแพทย์จะตรวจถ้อยคำ
 *    ทุกตัวเลขที่ออกจากที่นี่คือ "เกิดอะไรขึ้น" ไม่ใช่ "ปกติไหม"
 */
import type { BabyLogKind } from "@/db/schema";

export type BreastSide = "left" | "right";
export type MilkKind = "breast" | "formula" | "mixed";
export type DiaperKind = "wet" | "dirty" | "both";

export type BabyLogView = {
  id: string;
  childId: string | null;
  kind: BabyLogKind;
  startedAt: string;
  endedAt: string | null;
  leftSec: number | null;
  rightSec: number | null;
  side: BreastSide | null;
  sideStartedAt: string | null;
  ml: number | null;
  milk: MilkKind | null;
  leftMl: number | null;
  rightMl: number | null;
  diaper: DiaperKind | null;
  note: string | null;
  createdBy: string;
  createdByName: string | null;
};

export const KIND_ORDER: readonly BabyLogKind[] = [
  "breast",
  "bottle",
  "diaper",
  "sleep",
  "pump",
  "bath",
];

export const KIND_LABEL: Record<BabyLogKind, string> = {
  breast: "เต้า",
  bottle: "ขวดนม",
  diaper: "ผ้าอ้อม",
  sleep: "นอน",
  pump: "ปั๊มนม",
  bath: "อาบน้ำ",
};

export const MILK_LABEL: Record<MilkKind, string> = {
  breast: "นมแม่",
  formula: "นมผง",
  mixed: "ผสม",
};

export const DIAPER_LABEL: Record<DiaperKind, string> = {
  wet: "ฉี่",
  dirty: "อึ",
  both: "ทั้งคู่",
};

export const SIDE_LABEL: Record<BreastSide, string> = { left: "ซ้าย", right: "ขวา" };

export const isTimedKind = (k: BabyLogKind) => k === "breast" || k === "sleep";

const ms = (iso: string) => Date.parse(`${iso}Z`);

/** วินาทีจาก a ถึง b — ติดลบให้เป็น 0 (นาฬิกาสองเครื่องเหลื่อมกันได้เล็กน้อย) */
export function secondsBetween(a: string, b: string): number {
  const d = Math.round((ms(b) - ms(a)) / 1000);
  return Number.isFinite(d) && d > 0 ? d : 0;
}

/** เลื่อนเวลา n วินาที คงรูปแบบเดิม */
export function addSeconds(iso: string, n: number): string {
  return new Date(ms(iso) + n * 1000).toISOString().slice(0, 19);
}

export const isRunning = (r: Pick<BabyLogView, "endedAt">) => r.endedAt === null;

/** เต้า: วินาทีของแต่ละข้าง รวมช่วงที่กำลังจับอยู่ */
export function breastTotals(
  r: Pick<BabyLogView, "leftSec" | "rightSec" | "side" | "sideStartedAt" | "endedAt">,
  now: string,
): { left: number; right: number } {
  let left = r.leftSec ?? 0;
  let right = r.rightSec ?? 0;
  if (r.endedAt === null && r.sideStartedAt && r.side) {
    const live = secondsBetween(r.sideStartedAt, now);
    if (r.side === "left") left += live;
    else right += live;
  }
  return { left, right };
}

/** ความยาวของรายการ — เต้านับเฉพาะเวลาที่ให้จริง ไม่นับช่วงพัก */
export function durationSec(r: BabyLogView, now: string): number {
  if (r.kind === "breast") {
    const t = breastTotals(r, now);
    return t.left + t.right;
  }
  return secondsBetween(r.startedAt, r.endedAt ?? now);
}

/** ข้างถัดไปที่ควรให้ — สลับจากข้างล่าสุดของครั้งก่อน · ไม่มีประวัติ = null */
export function nextSide(last: Pick<BabyLogView, "side"> | null | undefined): BreastSide | null {
  if (!last?.side) return null;
  return last.side === "left" ? "right" : "left";
}

/**
 * จุดที่ใช้นับ "ผ่านไปนานแค่ไหนแล้ว"
 *
 * กินนับจากตอนเริ่ม (หมอและพยาบาลนับรอบกินจากตอนเริ่มทั้งนั้น)
 * นอนนับจากตอนตื่น — "นอนไปเมื่อ 3 ชม. ก่อน" ไม่มีประโยชน์ถ้าเพิ่งตื่นเมื่อกี้
 */
export function sinceAnchor(r: BabyLogView): string {
  return r.kind === "sleep" ? (r.endedAt ?? r.startedAt) : r.startedAt;
}

/** `1:30:12` หรือ `08:42` */
export function clockSec(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = String(s % 60).padStart(2, "0");
  return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${ss}` : `${String(m).padStart(2, "0")}:${ss}`;
}

/** `4 ชม. 50 น.` · `35 น.` · `ไม่ถึงนาที` */
export function spanLabel(sec: number): string {
  const m = Math.floor(Math.max(0, sec) / 60);
  if (m < 1) return "ไม่ถึงนาที";
  const h = Math.floor(m / 60);
  const mm = m % 60;
  if (h === 0) return `${mm} น.`;
  return mm ? `${h} ชม. ${mm} น.` : `${h} ชม.`;
}

/** ครั้งล่าสุดของแต่ละประเภท (รายการต้องเรียงเวลาเริ่มจากใหม่ไปเก่า หรือไม่เรียงก็ได้) */
export function latestByKind(rows: BabyLogView[]): Partial<Record<BabyLogKind, BabyLogView>> {
  const out: Partial<Record<BabyLogKind, BabyLogView>> = {};
  for (const r of rows) {
    const cur = out[r.kind];
    if (!cur || r.startedAt > cur.startedAt) out[r.kind] = r;
  }
  return out;
}

const dayStart = (day: string) => `${day}T00:00:00`;
const nextDayStart = (day: string) => addSeconds(dayStart(day), 86_400);

/** วินาทีที่รายการนี้ทับกับวันนั้น — นอนข้ามเที่ยงคืนนับแยกวัน */
function overlapSec(r: BabyLogView, day: string, now: string): number {
  const from = r.startedAt > dayStart(day) ? r.startedAt : dayStart(day);
  const endRaw = r.endedAt ?? now;
  const to = endRaw < nextDayStart(day) ? endRaw : nextDayStart(day);
  return secondsBetween(from, to);
}

export type DaySummary = {
  breast: { count: number; left: number; right: number };
  bottle: { count: number; ml: number; milks: MilkKind[] };
  diaper: { count: number; wet: number; dirty: number };
  sleep: { count: number; sec: number; running: boolean };
  pump: { count: number; ml: number; left: number; right: number };
  bath: { count: number };
};

/**
 * สรุปของวันหนึ่ง
 *
 * นับครั้งตามวันที่เริ่ม ยกเว้นเวลานอนที่ตัดตามวัน
 * ผ้าอ้อม "ทั้งคู่" นับทั้งฉี่และอึ แต่นับเป็นผืนเดียว
 */
export function summarizeDay(rows: BabyLogView[], day: string, now: string): DaySummary {
  const s: DaySummary = {
    breast: { count: 0, left: 0, right: 0 },
    bottle: { count: 0, ml: 0, milks: [] },
    diaper: { count: 0, wet: 0, dirty: 0 },
    sleep: { count: 0, sec: 0, running: false },
    pump: { count: 0, ml: 0, left: 0, right: 0 },
    bath: { count: 0 },
  };
  for (const r of rows) {
    const startsToday = r.startedAt.slice(0, 10) === day;
    switch (r.kind) {
      case "breast": {
        if (!startsToday) break;
        const t = breastTotals(r, now);
        s.breast.count++;
        s.breast.left += t.left;
        s.breast.right += t.right;
        break;
      }
      case "bottle":
        if (!startsToday) break;
        s.bottle.count++;
        s.bottle.ml += r.ml ?? 0;
        if (r.milk && !s.bottle.milks.includes(r.milk)) s.bottle.milks.push(r.milk);
        break;
      case "diaper":
        if (!startsToday) break;
        s.diaper.count++;
        if (r.diaper === "wet" || r.diaper === "both") s.diaper.wet++;
        if (r.diaper === "dirty" || r.diaper === "both") s.diaper.dirty++;
        break;
      case "sleep": {
        const sec = overlapSec(r, day, now);
        if (startsToday) s.sleep.count++;
        s.sleep.sec += sec;
        if (r.endedAt === null) s.sleep.running = true;
        break;
      }
      case "pump":
        if (!startsToday) break;
        s.pump.count++;
        s.pump.left += r.leftMl ?? 0;
        s.pump.right += r.rightMl ?? 0;
        s.pump.ml += (r.leftMl ?? 0) + (r.rightMl ?? 0);
        break;
      case "bath":
        if (startsToday) s.bath.count++;
        break;
    }
  }
  return s;
}

export type StripLane = "feed" | "diaper" | "sleep";
export type StripMark = {
  id: string;
  kind: BabyLogKind;
  lane: StripLane;
  /** นาทีนับจากเที่ยงคืนของวันนั้น 0–1440 */
  from: number;
  to: number;
  diaper: DiaperKind | null;
  running: boolean;
};

const LANE: Record<BabyLogKind, StripLane | null> = {
  breast: "feed",
  bottle: "feed",
  pump: "feed",
  diaper: "diaper",
  sleep: "sleep",
  bath: null,
};

/** จุด/แท่งบนแถบ 24 ชม. — ตัดส่วนที่อยู่นอกวันทิ้ง */
export function stripMarks(rows: BabyLogView[], day: string, now: string): StripMark[] {
  const base = ms(dayStart(day));
  const toMin = (iso: string) => Math.min(1440, Math.max(0, (ms(iso) - base) / 60_000));
  const out: StripMark[] = [];
  for (const r of rows) {
    const lane = LANE[r.kind];
    if (!lane) continue;
    const end = r.endedAt ?? now;
    if (end < dayStart(day) || r.startedAt >= nextDayStart(day)) continue;
    out.push({
      id: r.id,
      kind: r.kind,
      lane,
      from: toMin(r.startedAt),
      to: toMin(end),
      diaper: r.diaper,
      running: r.endedAt === null,
    });
  }
  return out.sort((a, b) => a.from - b.from);
}

/** ข้อความรองของแต่ละรายการในรายการล่าสุด */
export function detailLabel(r: BabyLogView, now: string): string {
  switch (r.kind) {
    case "breast": {
      const t = breastTotals(r, now);
      const parts = [];
      if (t.left) parts.push(`ซ้าย ${spanLabel(t.left)}`);
      if (t.right) parts.push(`ขวา ${spanLabel(t.right)}`);
      return parts.join(" · ") || "ยังไม่ได้เริ่มข้างไหน";
    }
    case "bottle":
      return `${r.ml ?? 0} มล.${r.milk ? ` · ${MILK_LABEL[r.milk]}` : ""}`;
    case "diaper":
      return r.diaper ? DIAPER_LABEL[r.diaper] : "";
    case "sleep":
      return spanLabel(durationSec(r, now));
    case "pump":
      return `${(r.leftMl ?? 0) + (r.rightMl ?? 0)} มล. · ซ้าย ${r.leftMl ?? 0} · ขวา ${r.rightMl ?? 0}`;
    case "bath":
      return "";
  }
}

/**
 * แก้เวลาเริ่มของรอบเต้าที่ยังจับอยู่ — "ลืมกดเริ่ม เริ่มจริงเมื่อห้านาทีก่อน"
 *
 * เวลาแยกข้าง เลื่อนแค่ startedAt ไม่พอ ส่วนต่างต้องไปตกที่ข้างที่กำลังให้อยู่
 * - กำลังจับอยู่: เลื่อน sideStartedAt ตาม (ไม่ก่อนเวลาเริ่มใหม่ และไม่ล้ำตอนนี้)
 * - พักอยู่: บวก/ลบเข้าเวลาของข้างล่าสุด (ไม่ติดลบ)
 */
export function shiftBreastStart(
  s: { startedAt: string; leftSec: number; rightSec: number; side: BreastSide; sideStartedAt: string | null },
  at: string,
  now: string,
): { startedAt: string; leftSec: number; rightSec: number; sideStartedAt: string | null } {
  const delta = Math.round((ms(s.startedAt) - ms(at)) / 1000); // บวก = เริ่มเร็วขึ้น
  if (s.sideStartedAt) {
    let side = addSeconds(s.sideStartedAt, -delta);
    if (side < at) side = at;
    if (side > now) side = now;
    return { startedAt: at, leftSec: s.leftSec, rightSec: s.rightSec, sideStartedAt: side };
  }
  const key = s.side === "left" ? "leftSec" : "rightSec";
  const next = { leftSec: s.leftSec, rightSec: s.rightSec };
  next[key] = Math.max(0, next[key] + delta);
  return { startedAt: at, ...next, sideStartedAt: null };
}
