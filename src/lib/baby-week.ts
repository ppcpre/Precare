/**
 * ไทม์ไลน์ 7 วัน (C1) — ฟังก์ชันล้วน
 *
 * ⚠️ ตัวเลขเฉลี่ยเทียบกับลูกคนเดียวกันในสัปดาห์ก่อนเท่านั้น ไม่มีเกณฑ์
 *    "ปกติ/น้อยไป" — เกณฑ์รอแพทย์ตรวจถ้อยคำ (เหมือน baby-log.ts)
 */
import { addSeconds, secondsBetween, summarizeDay, type BabyLogView } from "./baby-log";
import { shiftDay } from "./local-time";

/** 7 วันที่จบที่ `end` เรียงใหม่สุดก่อน */
export const weekDays = (end: string) => Array.from({ length: 7 }, (_, i) => shiftDay(end, -i));

/** ตัดของวันนั้นที่ไหน — วันนี้ตัดที่ตอนนี้ วันเก่าตัดที่สิ้นวัน */
export const dayUntil = (day: string, now: string) =>
  day === now.slice(0, 10) ? now : addSeconds(`${day}T00:00:00`, 86_400);

export type WeekStats = {
  /** จำนวนวันที่มีบันทึก — ตัวหาร */
  days: number;
  feeds: number;
  sleepSec: number;
  wet: number;
  longestSleepSec: number;
};

/**
 * เฉลี่ยต่อวัน หารด้วยวันที่มีบันทึกจริง ไม่ใช่ 7 เสมอ
 * (เริ่มใช้แอปกลางสัปดาห์ หรือวันที่ไม่มีใครบันทึก ไม่ควรดึงตัวเลขลง)
 */
export function weekStats(rows: BabyLogView[], days: string[], now: string): WeekStats {
  let n = 0;
  let feeds = 0;
  let sleepSec = 0;
  let wet = 0;
  for (const day of days) {
    if (day > now.slice(0, 10)) continue;
    const s = summarizeDay(rows, day, dayUntil(day, now));
    const any =
      s.breast.count + s.bottle.count + s.diaper.count + s.sleep.count + s.pump.count + s.bath.count > 0 ||
      s.sleep.sec > 0;
    if (!any) continue;
    n++;
    feeds += s.breast.count + s.bottle.count;
    sleepSec += s.sleep.sec;
    wet += s.diaper.wet;
  }

  const first = [...days].sort()[0];
  const last = addSeconds(`${[...days].sort().at(-1)}T00:00:00`, 86_400);
  let longest = 0;
  for (const r of rows) {
    // รอบที่ยังนอนอยู่ไม่นับ — ยังไม่รู้ว่ายาวแค่ไหน
    if (r.kind !== "sleep" || r.endedAt === null) continue;
    if (r.startedAt < `${first}T00:00:00` || r.startedAt >= last) continue;
    longest = Math.max(longest, secondsBetween(r.startedAt, r.endedAt));
  }

  const avg = (v: number) => (n ? v / n : 0);
  return { days: n, feeds: avg(feeds), sleepSec: avg(sleepSec), wet: avg(wet), longestSleepSec: longest };
}

/** `8` · `7.5` — ทศนิยมตำแหน่งเดียวพอ ตัวเลขเฉลี่ยไม่ต้องละเอียดกว่านี้ */
export const avgLabel = (v: number) => (Math.round(v * 10) / 10).toString();

/** `16 – 22 พ.ย.` · `28 ต.ค. – 3 พ.ย.` */
export function rangeLabel(start: string, end: string): string {
  const M = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");
  const [, sm, sd] = start.split("-").map(Number);
  const [, em, ed] = end.split("-").map(Number);
  return sm === em ? `${sd} – ${ed} ${M[em - 1]}` : `${sd} ${M[sm - 1]} – ${ed} ${M[em - 1]}`;
}

/** `อา. 22` */
export function weekdayLabel(day: string): string {
  const W = "อา. จ. อ. พ. พฤ. ศ. ส.".split(" ");
  const d = new Date(`${day}T00:00:00Z`);
  return `${W[d.getUTCDay()]} ${d.getUTCDate()}`;
}
