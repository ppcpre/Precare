/**
 * Utility สำหรับคำนวณอายุครรภ์
 * อ้างอิงมาตรฐาน: ตั้งครรภ์เต็มกำหนด = 40 สัปดาห์ (280 วัน) นับจาก LMP (Last Menstrual Period)
 */

const MS_PER_DAY = 1000 * 60 * 60 * 24;
const PREGNANCY_LENGTH_DAYS = 280; // 40 สัปดาห์

/** คำนวณวันคาดคลอด (EDD) จากวันประจำเดือนครั้งสุดท้าย (LMP) */
export function calculateDueDate(lmpDate: string | Date): Date {
  const lmp = new Date(lmpDate);
  return new Date(lmp.getTime() + PREGNANCY_LENGTH_DAYS * MS_PER_DAY);
}

/** ย้อนกลับ: ถ้ารู้วันคาดคลอด ให้คำนวณ LMP โดยประมาณ */
export function calculateLmpFromDueDate(dueDate: string | Date): Date {
  const edd = new Date(dueDate);
  return new Date(edd.getTime() - PREGNANCY_LENGTH_DAYS * MS_PER_DAY);
}

export interface GestationalAge {
  weeks: number;
  days: number;
  totalDays: number;
  trimester: 1 | 2 | 3;
}

/** คำนวณอายุครรภ์ปัจจุบัน (สัปดาห์ + วัน) จาก LMP */
export function calculateGestationalAge(
  lmpDate: string | Date,
  today: Date = new Date()
): GestationalAge {
  const lmp = new Date(lmpDate);
  const diffMs = today.getTime() - lmp.getTime();
  const totalDays = Math.max(0, Math.floor(diffMs / MS_PER_DAY));

  const weeks = Math.floor(totalDays / 7);
  const days = totalDays % 7;

  let trimester: 1 | 2 | 3 = 1;
  if (weeks >= 28) trimester = 3;
  else if (weeks >= 13) trimester = 2;

  return { weeks, days, totalDays, trimester };
}

/** จำนวนวันที่เหลือถึงวันคาดคลอด (ค่าติดลบ = เลยกำหนดแล้ว) */
export function daysUntilDueDate(dueDate: string | Date, today: Date = new Date()): number {
  const edd = new Date(dueDate);
  return Math.ceil((edd.getTime() - today.getTime()) / MS_PER_DAY);
}

/** ตรวจสอบว่าควรเปลี่ยนสถานะเป็น postpartum หรือยัง (ใช้ใน Phase 3) */
export function isPostpartum(dueDate: string | Date, today: Date = new Date()): boolean {
  return daysUntilDueDate(dueDate, today) < -14; // เผื่อ buffer 2 สัปดาห์หลังกำหนดคลอด
}
