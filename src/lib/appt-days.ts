/**
 * "เหลืออีกกี่วัน" ของนัดหมาย — นับเป็น **วันในปฏิทินไทย** ไม่ใช่ช่วง 24 ชั่วโมง
 *
 * ของเดิมเป็น `Math.ceil((new Date(iso).getTime() - now) / 86400000)` ซึ่งพังสองชั้น
 *
 * 1) `new Date("2026-10-09T08:00:00")` ไม่มี timezone ต่อท้าย JS จึงตีความตาม
 *    timezone ของเครื่องที่รัน — worker รันด้วย UTC เสมอ เวลานัดที่โรงพยาบาล
 *    จึงถูกเลื่อนไป 7 ชั่วโมง (บั๊กชนิดเดียวกับที่แก้ไปแล้วใน lib/local-time.ts)
 * 2) `Math.ceil` ของเศษลบคืน **-0** และ `-0 < 0` เป็น false นัดที่ผ่านไปแล้ว
 *    ไม่ถึง 24 ชั่วโมงจึงตกไปเข้าเงื่อนไข "วันนี้"
 *
 * อาการจริงที่เจอ: เช้าวันที่ 10 ต.ค. นัดของวันที่ 9 ขึ้นป้าย "วันนี้"
 * และถูกจัดเข้ากลุ่ม "วันนี้" ทั้งที่ผ่านไปแล้ว
 *
 * ตัวนี้เทียบ "วันที่" กับ "วันที่" ตรงๆ ไม่ผ่านการคำนวณช่วงเวลา จึงไม่มีเศษ
 * ให้ปัดและไม่ขึ้นกับ timezone ของเครื่อง
 */
import { localNowIso, localToday } from "@/lib/local-time";

const dayMs = (ymd: string) => Date.parse(`${ymd}T00:00:00Z`);

/** ลบ = ผ่านไปแล้ว · 0 = วันนี้ · 1 = พรุ่งนี้ */
export function daysFromNow(iso: string, now: number) {
  return Math.round((dayMs(iso.slice(0, 10)) - dayMs(localToday(now))) / 86_400_000);
}

/**
 * เลยเวลานัดไปแล้วหรือยัง — เทียบสตริงแบบเดียวกับที่ query ใช้แบ่งแท็บ
 * ต่างจาก daysFromNow ตรงที่นัดเช้านี้ตอนบ่ายคือ "วันนี้" แต่ "เลยเวลาแล้ว"
 */
export const isPastAppt = (iso: string, now: number) => iso < localNowIso(now);

/** จัดกลุ่มตามความใกล้ ตาม screen-blueprint §6.4 */
export function bucketOf(days: number) {
  if (days < 0) return "ผ่านมาแล้ว";
  if (days === 0) return "วันนี้";
  if (days <= 7) return "สัปดาห์นี้";
  if (days <= 30) return "เดือนนี้";
  return "ในอนาคต";
}
