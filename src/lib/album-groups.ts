/**
 * จัดกลุ่มรูปในอัลบั้ม — เดือน แล้วแยกเป็นวัน
 *
 * ⚠️ ไม่จัดตามสัปดาห์ครรภ์อีกแล้ว
 *    หน้าอัลบั้มจะถูกใช้กับบันทึกเรื่องอื่นที่ไม่ใช่การตั้งครรภ์ด้วย
 *    วันที่มีเสมอ ส่วนสัปดาห์มีเฉพาะตอนตั้งครรภ์ จึงเป็นแค่แท็กที่ห้อยมา
 *
 *    ของเดิมจัดตามสัปดาห์แล้วเอาวันที่ของ "รูปใบแรก" มาแปะเป็นหัวกลุ่ม
 *    ทั้งที่ในสัปดาห์นั้นมีรูปจากหลายวัน คนอ่านเข้าใจว่าถ่ายวันเดียวกัน
 */

export type AlbumPhoto = {
  id: string;
  week: number | null;
  takenAt: string;
  type: string;
  pinned: boolean;
  caption: string | null;
  r2Key: string;
  createdAt: string;
  uploaderName: string;
};

export type DayGroup<T> = {
  /** "2026-08-26" */
  key: string;
  items: T[];
  /**
   * สัปดาห์ครรภ์ของวันนั้น — null เมื่อไม่มี
   * รูปที่ถ่ายวันเดียวกันย่อมอยู่สัปดาห์เดียวกันเสมอ เพราะสัปดาห์คำนวณจากวันที่ถ่าย
   * ถ้าเจอไม่ตรงกัน (ข้อมูลเก่าที่คำนวณผิด) ใช้ค่าที่พบบ่อยที่สุดแทนการเดา
   */
  week: number | null;
};

export type MonthGroup<T> = {
  /** "2026-08" */
  key: string;
  days: DayGroup<T>[];
  count: number;
};

/** ตัดจากสตริงตรงๆ ไม่ผ่าน Date เพื่อเลี่ยงการเลื่อนวันเพราะ timezone */
export const dayKeyOf = (takenAt: string) => takenAt.slice(0, 10);
export const monthKeyOf = (takenAt: string) => takenAt.slice(0, 7);

function weekOfDay(items: readonly { week: number | null }[]): number | null {
  const counts = new Map<number, number>();
  for (const it of items) {
    if (it.week == null) continue;
    counts.set(it.week, (counts.get(it.week) ?? 0) + 1);
  }
  if (counts.size === 0) return null;
  let best: number | null = null;
  let bestCount = 0;
  for (const [week, n] of counts) {
    if (n > bestCount) {
      best = week;
      bestCount = n;
    }
  }
  return best;
}

/**
 * เรียงจากใหม่ไปเก่าทั้งเดือนและวัน — ตรงกับที่ query ส่งมา
 * ไม่เรียงซ้ำในนี้ เพื่อให้ลำดับรูปในแต่ละวันเป็นไปตามที่ query กำหนดไว้แล้ว
 */
export function groupByMonthDay<T extends { takenAt: string; week: number | null }>(
  items: readonly T[],
): MonthGroup<T>[] {
  const months = new Map<string, Map<string, T[]>>();

  for (const it of items) {
    const mk = monthKeyOf(it.takenAt);
    const dk = dayKeyOf(it.takenAt);
    let days = months.get(mk);
    if (!days) {
      days = new Map();
      months.set(mk, days);
    }
    const arr = days.get(dk);
    if (arr) arr.push(it);
    else days.set(dk, [it]);
  }

  return [...months.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([key, days]) => {
      const dayGroups = [...days.entries()]
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([dk, list]) => ({ key: dk, items: list, week: weekOfDay(list) }));
      return {
        key,
        days: dayGroups,
        count: dayGroups.reduce((n, d) => n + d.items.length, 0),
      };
    });
}
