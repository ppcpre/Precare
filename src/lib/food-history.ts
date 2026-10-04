/**
 * จัดกลุ่มยอดรวมรายวัน เป็นช่องสำหรับกราฟ รายวัน / รายสัปดาห์ / รายเดือน
 *
 * แยกออกมาเป็นฟังก์ชันล้วนเพราะตรรกะการหารเฉลี่ยคือจุดที่พลาดง่ายที่สุด
 * และเป็นจุดที่ถ้าพลาดแล้วหน้าจอไม่ฟ้องอะไรเลย — แค่โชว์เลขผิด
 */

export const RANGES = ["day", "week", "month"] as const;
export type Range = (typeof RANGES)[number];

export const RANGE_LABEL: Record<Range, string> = {
  day: "รายวัน",
  week: "รายสัปดาห์",
  month: "รายเดือน",
};

/** จำนวนช่องที่แสดงต่อมุมมอง — พอให้เห็นแนวโน้มแต่ยังอ่านออกบนจอมือถือ */
export const BUCKETS: Record<Range, number> = { day: 14, week: 8, month: 6 };

export interface DailyTotal {
  eatenOn: string;
  kcal: number;
  carbG: number;
  sugarG: number;
  proteinG: number;
  items: number;
}

export interface Bucket {
  /** คีย์ของช่อง — วันที่เริ่มช่อง (YYYY-MM-DD) */
  key: string;
  label: string;
  /** ค่าเฉลี่ยต่อวัน เฉพาะวันที่มีบันทึก (null = ไม่มีบันทึกในช่องนี้) */
  kcal: number | null;
  carbG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  /** จำนวนวันที่มีบันทึกในช่อง — ต้องโชว์ ไม่งั้นค่าเฉลี่ยอ่านผิดได้ */
  days: number;
}

const D_MS = 86_400_000;
const M_SHORT = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");

/** YYYY-MM-DD → เที่ยงคืนของวันนั้นเป็น ms แบบ UTC (ใช้เป็นตัวนับวันล้วนๆ) */
const dayMs = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const toIso = (ms: number) => new Date(ms).toISOString().slice(0, 10);

/** วันจันทร์ของสัปดาห์ที่วันนั้นอยู่ — getUTCDay() คืน 0 สำหรับวันอาทิตย์ */
const mondayOf = (iso: string) => {
  const ms = dayMs(iso);
  const dow = new Date(ms).getUTCDay();
  return toIso(ms - ((dow + 6) % 7) * D_MS);
};

const monthOf = (iso: string) => `${iso.slice(0, 7)}-01`;

/** ต้นช่องที่ย้อนไปจาก `today` กี่ช่อง — ใช้คำนวณช่วงที่ต้องดึงจากฐานข้อมูล */
export function rangeStart(range: Range, today: string): string {
  const n = BUCKETS[range] - 1;
  if (range === "day") return toIso(dayMs(today) - n * D_MS);
  if (range === "week") return mondayOf(toIso(dayMs(mondayOf(today)) - n * 7 * D_MS));
  const [y, m] = today.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 - n, 1));
  return d.toISOString().slice(0, 10);
}

const labelOf = (range: Range, key: string): string => {
  const [y, m, d] = key.split("-").map(Number);
  if (range === "month") return `${M_SHORT[m - 1]} ${String((y + 543) % 100).padStart(2, "0")}`;
  // รายวันกับรายสัปดาห์เป็นช่วงสั้น ไม่ต้องมีปีให้เกะกะ
  return range === "day" ? `${d}` : `${d} ${M_SHORT[m - 1]}`;
};

/**
 * สร้างช่องทั้งหมดของมุมมอง (รวมช่องที่ไม่มีบันทึก) แล้วเฉลี่ยค่าในแต่ละช่อง
 *
 * หารด้วย "จำนวนวันที่มีบันทึก" ไม่ใช่จำนวนวันในปฏิทิน เพราะสัปดาห์ที่บันทึก
 * แค่สองวันถ้าหารเจ็ด จะกลายเป็นว่ากินน้อยจนน่ากลัว ซึ่งไม่เป็นความจริง
 */
export function bucketize(rows: DailyTotal[], range: Range, today: string): Bucket[] {
  const keyOf = (iso: string) =>
    range === "day" ? iso : range === "week" ? mondayOf(iso) : monthOf(iso);

  const start = rangeStart(range, today);
  const keys: string[] = [];
  if (range === "month") {
    const [y, m] = start.split("-").map(Number);
    for (let i = 0; i < BUCKETS.month; i++) {
      keys.push(new Date(Date.UTC(y, m - 1 + i, 1)).toISOString().slice(0, 10));
    }
  } else {
    const step = range === "day" ? D_MS : 7 * D_MS;
    for (let i = 0; i < BUCKETS[range]; i++) keys.push(toIso(dayMs(start) + i * step));
  }

  const sums = new Map<string, { kcal: number; carbG: number; sugarG: number; proteinG: number; days: number }>();
  for (const r of rows) {
    // นับเป็น "วันที่มีบันทึก" เฉพาะวันที่มีเมนูจริง ไม่ใช่แถวผลรวมที่เป็นศูนย์หมด
    if (r.items === 0) continue;
    const k = keyOf(r.eatenOn);
    const acc = sums.get(k) ?? { kcal: 0, carbG: 0, sugarG: 0, proteinG: 0, days: 0 };
    acc.kcal += r.kcal;
    acc.carbG += r.carbG;
    acc.sugarG += r.sugarG;
    acc.proteinG += r.proteinG;
    acc.days += 1;
    sums.set(k, acc);
  }

  return keys.map((key) => {
    const a = sums.get(key);
    if (!a || a.days === 0) {
      return { key, label: labelOf(range, key), kcal: null, carbG: null, sugarG: null, proteinG: null, days: 0 };
    }
    const avg = (v: number) => Math.round(v / a.days);
    return {
      key,
      label: labelOf(range, key),
      kcal: avg(a.kcal),
      carbG: avg(a.carbG),
      sugarG: avg(a.sugarG),
      proteinG: avg(a.proteinG),
      days: a.days,
    };
  });
}
