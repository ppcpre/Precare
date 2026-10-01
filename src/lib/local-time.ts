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
