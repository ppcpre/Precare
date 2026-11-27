/**
 * สรุปค่าใช้จ่ายนัดหมาย
 *
 * แยกออกมาจาก queries.ts เพราะเป็นการคำนวณล้วน ไม่แตะ D1 เลย
 * ทำให้เทสต์ได้ตรงๆ โดยไม่ต้อง seed ฐานข้อมูล และเอาไปใช้ซ้ำได้ทุกมุมมอง
 *
 * กติกาที่ยึดตลอดทั้งไฟล์
 * - null = ยังไม่ได้ระบุ · 0 = ไปมาแล้วไม่เสียเงิน สองอย่างนี้คนละความหมาย
 * - ยอดรวมนับเฉพาะที่ไม่ใช่ null และต้องรายงานเสมอว่าเหลือกี่นัดที่ยังไม่ระบุ
 *   ยอดที่เงียบๆ ไม่นับนัดที่ยังไม่กรอกคือตัวเลขหลอก
 */
import type { ClaimStatus } from "@/db/schema";

export type CostItem = {
  id: string;
  apptDatetime: string;
  title: string | null;
  location: string | null;
  groupId: string | null;
  groupName: string | null;
  groupColor: string | null;
  costSatang: number | null;
  claimStatus: ClaimStatus;
};

export type Totals = {
  /** รวมเฉพาะนัดที่ระบุแล้ว */
  totalSatang: number;
  /** จำนวนนัดที่ระบุแล้ว ใช้หารหาค่าเฉลี่ย */
  counted: number;
  /** จำนวนนัดที่ยังไม่ระบุ — ต้องแสดงคู่กับยอดรวมเสมอ */
  missing: number;
  /** เฉลี่ยต่อนัด — null เมื่อยังไม่มีนัดไหนระบุเลย ไม่ใช่ 0 */
  avgSatang: number | null;
  claimableSatang: number;
  claimedSatang: number;
};

export function totalsOf(items: readonly CostItem[]): Totals {
  let totalSatang = 0;
  let counted = 0;
  let missing = 0;
  let claimableSatang = 0;
  let claimedSatang = 0;

  for (const it of items) {
    if (it.costSatang == null) {
      missing++;
      continue;
    }
    totalSatang += it.costSatang;
    counted++;
    // "เบิกไม่ได้" ไม่นับเป็นยอดที่เบิกได้ ส่วน "เบิกแล้ว" นับทั้งสองช่อง
    if (it.claimStatus !== "no") claimableSatang += it.costSatang;
    if (it.claimStatus === "done") claimedSatang += it.costSatang;
  }

  return {
    totalSatang,
    counted,
    missing,
    avgSatang: counted === 0 ? null : Math.round(totalSatang / counted),
    claimableSatang,
    claimedSatang,
  };
}

/** คีย์เดือนแบบ YYYY-MM ตัดจาก ISO ตรงๆ ไม่ผ่าน Date เพื่อเลี่ยงปัญหา timezone */
export const monthKeyOf = (isoDatetime: string) => isoDatetime.slice(0, 7);

export type MonthBucket = { key: string; items: CostItem[]; totals: Totals };

/** เรียงจากเดือนเก่าไปใหม่ เพื่อให้แถบเลือกเดือนอ่านจากซ้ายไปขวาตามเวลา */
export function byMonth(items: readonly CostItem[]): MonthBucket[] {
  const map = new Map<string, CostItem[]>();
  for (const it of items) {
    const k = monthKeyOf(it.apptDatetime);
    const arr = map.get(k);
    if (arr) arr.push(it);
    else map.set(k, [it]);
  }
  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, list]) => ({ key, items: list, totals: totalsOf(list) }));
}

export type GroupBucket = {
  id: string | null;
  name: string;
  color: string;
  items: CostItem[];
  totals: Totals;
};

/**
 * แยกตามกลุ่มการรักษา นัดที่ไม่ได้เลือกกลุ่มรวมกันเป็น "ทั่วไป"
 * เรียงจากยอดมากไปน้อย เพราะคำถามแรกเสมอคือเงินไปลงเรื่องไหนมากที่สุด
 */
export function byGroup(items: readonly CostItem[]): GroupBucket[] {
  const map = new Map<string, GroupBucket>();
  for (const it of items) {
    const key = it.groupId ?? "";
    let b = map.get(key);
    if (!b) {
      b = {
        id: it.groupId,
        name: it.groupName ?? "ทั่วไป",
        color: it.groupColor ?? "clay",
        items: [],
        totals: totalsOf([]),
      };
      map.set(key, b);
    }
    b.items.push(it);
  }
  const out = [...map.values()];
  for (const b of out) b.totals = totalsOf(b.items);
  return out.sort((a, b) => b.totals.totalSatang - a.totals.totalSatang);
}

/**
 * ประมาณการค่าใช้จ่ายที่เหลือจนถึงวันคลอด
 *
 * ตั้งใจรับเฉพาะ items ของกลุ่มเดียว (ฝากครรภ์) ไม่ใช่ทุกกลุ่ม
 * ถ้าเอาทุกกลุ่มมาเฉลี่ย จะกลายเป็นเอาค่าทำฟันไปคูณจำนวนนัดฝากครรภ์ที่เหลือ
 * ซึ่งไม่มีความหมาย
 *
 * null = ยังประมาณไม่ได้ (ยังไม่มีนัดไหนระบุ หรือไม่มีนัดในอนาคตเหลือแล้ว)
 */
export function estimateRemaining(items: readonly CostItem[], nowIso: string): number | null {
  const past = items.filter((i) => i.apptDatetime < nowIso);
  const { avgSatang } = totalsOf(past);
  if (avgSatang == null) return null;

  const upcoming = items.filter((i) => i.apptDatetime >= nowIso && i.costSatang == null).length;
  if (upcoming === 0) return null;
  return avgSatang * upcoming;
}
