/**
 * "ตอนนี้" ในรูปแบบเดียวกับที่เก็บเวลานัดหมาย
 *
 * `appointments.appt_datetime` เก็บเป็นเวลาที่โรงพยาบาลแบบไม่มี timezone
 * เช่น `2026-10-01T09:00:00` (ดู src/components/appointments/form.tsx)
 * แต่ worker รันด้วยเวลา UTC เสมอ การเทียบกับ `new Date().toISOString()`
 * จึงเป็นการเอาเวลาไทยไปเทียบกับเวลา UTC ตรงๆ
 *
 * ไทยเร็วกว่า UTC 7 ชั่วโมง ผลคือ **นัดที่ผ่านไปแล้วยังถูกนับว่า "กำลังจะถึง"
 * ได้นานถึง 7 ชั่วโมง** — โผล่บนหน้าแรกเป็นนัดถัดไป ค้างในแท็บกำลังจะถึง
 * และ service worker ก็ยังหยิบนัดนั้นไปแจ้งเตือน
 *
 * ใช้ตัวนี้ทุกครั้งที่ต้องเทียบกับ appt_datetime ห้ามใช้ toISOString()
 * (ตัวจับเวลาใน workers/cron ใช้ฟังก์ชันเดียวกันนี้)
 */
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;

/**
 * คืน `YYYY-MM-DDTHH:MM:SS` ตามเวลาไทย — ความยาวเท่ากับที่เก็บในฐานข้อมูลเสมอ
 * การเทียบสตริงจึงให้ผลเดียวกับการเทียบเวลาจริง
 */
export const localNowIso = (now: number = Date.now()) =>
  new Date(now + BANGKOK_OFFSET_MS).toISOString().slice(0, 19);

/** วันนี้ตามเวลาไทยในรูปแบบ YYYY-MM-DD */
export const localToday = (now: number = Date.now()) => localNowIso(now).slice(0, 10);

/**
 * เลื่อนวัน n วันจาก `YYYY-MM-DD` — บวก/ลบได้ ข้ามเดือนข้ามปีเอง
 *
 * คิดด้วย UTC ล้วนโดยตั้งใจ: ค่าที่รับเข้ามาเป็น "วันตามปฏิทินไทย" ที่ไม่มีเวลา
 * ถ้าแปลงเป็นเวลาท้องถิ่นของเครื่องก่อน เครื่องที่ตั้ง timezone อื่นจะได้วันเพี้ยน
 */
export const shiftDay = (iso: string, n: number) =>
  new Date(Date.parse(`${iso}T00:00:00Z`) + n * 86_400_000).toISOString().slice(0, 10);

/**
 * `YYYY-MM-DD` ที่เป็นวันจริง — กันค่าที่ส่งมาทาง URL หรือฟอร์ม
 *
 * เช็คด้วยการแปลงกลับแล้วเทียบ ไม่ใช่แค่ `Date.parse` ไม่เป็น NaN เพราะ
 * `2026-02-30` ไม่ใช่ NaN — มันเลื่อนไปเป็น 2026-03-02 เงียบๆ
 * ถ้าปล่อยผ่าน คนกรอกวันที่ 30 ก.พ. จะได้บันทึกไปอยู่อีกวันโดยไม่มีใครรู้
 */
export const isValidDay = (v: string | undefined): v is string => {
  if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const t = Date.parse(`${v}T00:00:00Z`);
  return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
};
