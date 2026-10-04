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

export const METRICS = ["kcal", "carbG", "sugarG", "proteinG"] as const;
export type Metric = (typeof METRICS)[number];

export interface DailyTotal {
  eatenOn: string;
  kcal: number;
  carbG: number;
  sugarG: number;
  proteinG: number;
  /** จำนวนเมนูที่มีค่านั้นจริง (ไม่ใช่จำนวนเมนูทั้งหมด — ดู getFoodDailyTotals) */
  nKcal: number;
  nCarbG: number;
  nSugarG: number;
  nProteinG: number;
}

const COUNT_OF: Record<Metric, keyof DailyTotal> = {
  kcal: "nKcal",
  carbG: "nCarbG",
  sugarG: "nSugarG",
  proteinG: "nProteinG",
};

export interface Bucket {
  /** คีย์ของช่อง — วันที่เริ่มช่อง (YYYY-MM-DD) */
  key: string;
  label: string;
  /** ค่าเฉลี่ยต่อวันของสารอาหารที่เลือก (null = ไม่มีวันไหนในช่องนี้มีค่านี้) */
  value: number | null;
  /** จำนวนวันที่มีค่านี้ — ต้องโชว์ ไม่งั้นค่าเฉลี่ยอ่านผิดได้ */
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
 * หารด้วย "จำนวนวันที่มีค่านี้" ไม่ใช่จำนวนวันในปฏิทิน เพราะสัปดาห์ที่บันทึก
 * แค่สองวันถ้าหารเจ็ด จะกลายเป็นว่ากินน้อยจนน่ากลัว ซึ่งไม่เป็นความจริง
 *
 * คิดทีละสารอาหารเพราะ "วันที่บันทึก" ของแต่ละค่าไม่เท่ากัน — คนกรอกแคล
 * แต่เว้นโปรตีนว่างได้ ถ้าใช้ตัวหารร่วมกัน ค่าที่กรอกน้อยกว่าจะถูกเฉลี่ยต่ำเกินจริง
 */
export function bucketize(
  rows: DailyTotal[],
  range: Range,
  today: string,
  metric: Metric,
): Bucket[] {
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

  const countKey = COUNT_OF[metric];
  const sums = new Map<string, { total: number; days: number }>();
  for (const r of rows) {
    // วันที่ไม่มีเมนูไหนมีค่านี้เลย ไม่นับเป็น "วันที่บันทึก" ของสารอาหารนี้
    // ไม่งั้นวันที่บันทึกแต่ไม่ได้ใส่ตัวเลข จะกลายเป็นวันที่กินศูนย์
    if (r[countKey] === 0) continue;
    const k = keyOf(r.eatenOn);
    const acc = sums.get(k) ?? { total: 0, days: 0 };
    acc.total += r[metric];
    acc.days += 1;
    sums.set(k, acc);
  }

  return keys.map((key) => {
    const a = sums.get(key);
    return {
      key,
      label: labelOf(range, key),
      value: a ? Math.round(a.total / a.days) : null,
      days: a?.days ?? 0,
    };
  });
}
