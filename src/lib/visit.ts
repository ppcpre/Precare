import { isHighBp } from "@/lib/format";
import { SLOW_VS_AVERAGE, averageMs, formatDuration, isSlowVsAverage, type SessionView } from "@/lib/kicks";

/**
 * สรุปก่อนพบแพทย์ — ตรรกะล้วน ไม่แตะฐานข้อมูล
 *
 * ข้อจำกัดที่กำหนดทุกอย่างในไฟล์นี้: **หมอมีเวลาต่อคนไม่ถึง 10 นาที**
 * หน้าสรุปต้องอ่านจบใน 15 วินาที ของผิดปกติจึงต้องถูก "คัดมาให้" ไม่ใช่ให้ไล่หาเอง
 *
 * ⚠️ ข้อห้ามเดียวกับนับลูกดิ้น: ตรงนี้ **ชี้ให้ดู ไม่ใช่วินิจฉัย**
 *    เขียนว่า "ความดัน 148/92 สูงกว่าเกณฑ์" ได้
 *    ห้ามเขียนว่า "เสี่ยงครรภ์เป็นพิษ" หรืออะไรที่เป็นการสรุปโรค
 */

/**
 * เกณฑ์ทั้งหมดอยู่ตรงนี้ที่เดียว พร้อมที่มา
 *
 * เหตุผลที่รวมไว้: วันหนึ่งหมอบอกว่าเกณฑ์ควรเป็นอีกค่า จะได้แก้ที่เดียว
 * ถ้ากระจายอยู่ในหน้าจอ การแก้จะกลายเป็นการไล่หาแล้วลืมบางจุด
 *
 * ⚠️ ตัวเลขพวกนี้เป็น "ค่าตั้งต้นที่พอใช้คุยกับหมอได้" ไม่ใช่เกณฑ์ทางการแพทย์
 *    ที่ผ่านการตรวจ ต้องให้คนที่รู้จริงตรวจก่อนเปิดให้คนนอกใช้
 */
export const VISIT_RULES = {
  /** ความดันสูง — ใช้ตัวเดียวกับที่หน้าบันทึกสุขภาพใช้อยู่แล้ว (>= 140/90) */
  highBp: isHighBp,

  /**
   * น้ำหนักขึ้นเร็วผิดปกติ — เกิน 1 กก. ต่อสัปดาห์
   *
   * อ้างอิงคร่าวจากคำแนะนำทั่วไปที่ว่าไตรมาส 2-3 ควรขึ้นราว 0.4-0.5 กก./สัปดาห์
   * ตั้งไว้ที่เท่าตัวเพื่อไม่ให้เตือนพร่ำเพรื่อ — เตือนบ่อยเกินไปคือไม่ได้เตือน
   */
  weightKgPerWeek: 1.0,

  /**
   * ลูกดิ้นช้ากว่าปกติของตัวเอง — **ไม่ประกาศซ้ำที่นี่**
   *
   * เกณฑ์นี้มีอยู่แล้วใน src/lib/kicks.ts (SLOW_VS_AVERAGE) และหน้านับลูกดิ้น
   * ใช้ค่านั้นอยู่ ถ้าประกาศเลขซ้ำไว้สองที่ วันหนึ่งจะแก้ที่เดียวแล้วสองหน้า
   * บอกไม่ตรงกัน ซึ่งเป็นสิ่งที่ไฟล์นี้ตั้งใจป้องกันตั้งแต่แรก
   *
   * เทียบกับ "ค่าเฉลี่ยของคนคนนั้น" ไม่ใช่ค่ากลางของประชากร
   * เพราะจังหวะการดิ้นต่างกันมากในแต่ละคน การเทียบกับตัวเองจึงมีความหมายกว่า
   */
  kickSlowMultiplier: SLOW_VS_AVERAGE,

  /** ต้องมีอย่างน้อยกี่รอบถึงจะเอาค่าเฉลี่ยมาเทียบได้ */
  kickMinSessions: 3,
} as const;

export type WeightPoint = { date: string; weight: number };
export type BpPoint = { date: string; systolic: number; diastolic: number };

export type Flag = { text: string; severity: "warn" | "bad" };

export type VisitSummary = {
  /** วันที่พบแพทย์ครั้งที่แล้ว — null = ยังไม่เคยมีนัดที่ผ่านมา */
  since: string | null;
  daysSince: number | null;
  flags: Flag[];
  weight: {
    latest: WeightPoint | null;
    sinceLast: number | null;
    total: number | null;
  };
  bp: { latest: BpPoint | null; previous: BpPoint | null; count: number };
  kicks: { averageMs: number | null; slowest: SessionView | null; count: number };
  symptoms: string[];
  /** ไม่มีอะไรจะสรุปเลย — หน้าจอต้องบอกให้ไปบันทึกก่อน ไม่ใช่โชว์การ์ดว่างๆ */
  empty: boolean;
};

const dayDiff = (a: string, b: string) =>
  Math.round((Date.parse(b.slice(0, 10)) - Date.parse(a.slice(0, 10))) / 86_400_000);

/**
 * "2026-09-12" -> "12 ก.ย." — ตัดตัวเลขจากสตริงตรงๆ ไม่ผ่าน Date
 *
 * `new Date("2026-09-12")` อ่านเป็นเที่ยงคืน UTC แล้ว getDate() คืนค่าตามเขตเวลา
 * ของเครื่อง ซึ่งเลื่อนไปหนึ่งวันในเขตเวลาที่ติดลบ ที่นี่ไทยเลยไม่เจอ
 * แต่การเลี่ยงไว้ตั้งแต่แรกถูกกว่ามาไล่หาทีหลัง (หลักเดียวกับ src/lib/album-groups.ts)
 *
 * ไม่ใส่ปี เพราะทุกอย่างในหน้านี้อยู่ในช่วงไม่กี่สัปดาห์ที่ผ่านมา ปีจึงเป็นสัญญาณรบกวน
 */
const thaiShort = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  const M = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");
  return `${d} ${M[m - 1]}`;
};

/**
 * ประกอบสรุปจากข้อมูลที่มีอยู่แล้วทั้งหมด — ไม่เพิ่มโครงข้อมูลใหม่สักตัว
 *
 * `logs` ต้องเรียงจากเก่าไปใหม่ และเป็นของครอบครัวเดียวเท่านั้น
 * (การกรอง familyId เป็นหน้าที่ของชั้น query ไม่ใช่ตรงนี้)
 */
export function buildVisitSummary(input: {
  since: string | null;
  today: string;
  logs: { logDate: string; weight: number | null; bpSystolic: number | null; bpDiastolic: number | null; symptoms: string | null }[];
  sessions: SessionView[];
}): VisitSummary {
  const { since, today } = input;
  const inWindow = <T extends { logDate?: string; startedAt?: string }>(x: T) => {
    const d = (x.logDate ?? x.startedAt ?? "").slice(0, 10);
    return since ? d >= since.slice(0, 10) : true;
  };

  const logs = input.logs;
  const recent = logs.filter(inWindow);

  const weights = logs
    .filter((l) => l.weight != null)
    .map((l) => ({ date: l.logDate, weight: l.weight as number }));
  const latestWeight = weights.at(-1) ?? null;
  const weightAtSince = since
    ? (weights.filter((w) => w.date.slice(0, 10) <= since.slice(0, 10)).at(-1) ?? null)
    : null;
  const firstWeight = weights[0] ?? null;

  const sinceLast =
    latestWeight && weightAtSince && latestWeight !== weightAtSince
      ? round1(latestWeight.weight - weightAtSince.weight)
      : null;
  const total =
    latestWeight && firstWeight && latestWeight !== firstWeight
      ? round1(latestWeight.weight - firstWeight.weight)
      : null;

  const bps = logs
    .filter((l) => l.bpSystolic != null && l.bpDiastolic != null)
    .map((l) => ({
      date: l.logDate,
      systolic: l.bpSystolic as number,
      diastolic: l.bpDiastolic as number,
    }));

  const kickSessions = input.sessions.filter((s) => s.durationMs != null);
  const avg = averageMs(kickSessions);
  const slowest =
    kickSessions.length > 0
      ? kickSessions.reduce((a, b) => ((b.durationMs ?? 0) > (a.durationMs ?? 0) ? b : a))
      : null;

  const symptoms = [
    ...new Set(
      recent.flatMap((l) => {
        if (!l.symptoms) return [];
        try {
          const parsed: unknown = JSON.parse(l.symptoms);
          return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
        } catch {
          // แถวที่ JSON เพี้ยนไม่ควรทำให้ทั้งหน้าล่ม — ข้ามแถวนั้นไป
          return [];
        }
      }),
    ),
  ];

  return {
    since,
    daysSince: since ? dayDiff(since, today) : null,
    flags: buildFlags({ bps, weights, weightAtSince, latestWeight, sessions: kickSessions, avg, slowest }),
    weight: { latest: latestWeight, sinceLast, total },
    bp: { latest: bps.at(-1) ?? null, previous: bps.at(-2) ?? null, count: bps.length },
    kicks: { averageMs: avg, slowest, count: kickSessions.length },
    symptoms,
    empty: weights.length === 0 && bps.length === 0 && kickSessions.length === 0,
  };
}

/**
 * เรียงจากหนักไปเบา — สิ่งที่หมอต้องเห็นก่อนอยู่บนสุด
 *
 * จงใจไม่รวมทุกอย่างที่ผิดปกติเล็กน้อย รายการยาวเกินสามสี่บรรทัด
 * จะกลายเป็นสิ่งที่ไม่มีใครอ่าน ซึ่งแย่กว่าไม่มีรายการเลย
 */
function buildFlags(d: {
  bps: BpPoint[];
  weights: WeightPoint[];
  weightAtSince: WeightPoint | null;
  latestWeight: WeightPoint | null;
  sessions: SessionView[];
  avg: number | null;
  slowest: SessionView | null;
}): Flag[] {
  const flags: Flag[] = [];

  const highBp = d.bps.filter((b) => VISIT_RULES.highBp(b.systolic, b.diastolic)).at(-1);
  if (highBp) {
    flags.push({
      severity: "bad",
      text: `ความดัน ${highBp.systolic}/${highBp.diastolic} เมื่อ ${thaiShort(highBp.date)} สูงกว่าเกณฑ์`,
    });
  }

  if (d.latestWeight && d.weightAtSince) {
    const weeks = Math.max(1, dayDiff(d.weightAtSince.date, d.latestWeight.date) / 7);
    const gain = d.latestWeight.weight - d.weightAtSince.weight;
    if (gain / weeks > VISIT_RULES.weightKgPerWeek) {
      flags.push({
        severity: "warn",
        text: `น้ำหนักขึ้น ${round1(gain)} กก. ใน ${Math.round(weeks)} สัปดาห์`,
      });
    }
  }

  // เทียบกับค่าเฉลี่ยของตัวเองเท่านั้น และต้องมีรอบมากพอให้ค่าเฉลี่ยมีความหมาย
  if (
    d.avg != null &&
    d.slowest?.durationMs != null &&
    d.sessions.length >= VISIT_RULES.kickMinSessions &&
    isSlowVsAverage(d.slowest, d.avg)
  ) {
    flags.push({
      severity: "warn",
      text: `${thaiShort(d.slowest.startedAt)} นับลูกดิ้นครบใช้เวลา ${formatDuration(d.slowest.durationMs)} (ปกติ ${formatDuration(d.avg)})`,
    });
  }

  return flags;
}

const round1 = (n: number) => Math.round(n * 10) / 10;
