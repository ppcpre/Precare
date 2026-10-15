/**
 * กฎของรหัสผ่านใหม่ — แยกออกมาเพื่อให้เทสต์ได้และใช้ข้อความเดียวกันทุกที่
 *
 * ขั้นต่ำ 8 ตัวบังคับที่ better-auth อยู่แล้ว (minPasswordLength ใน lib/auth.ts)
 * ที่เพิ่มตรงนี้คือสองข้อที่ความยาวอย่างเดียวจับไม่ได้ และเป็นสองแบบที่คนทำจริง
 *
 * ไม่ทำตัววัดความแข็งแรงแบบมีแถบสี เพราะมันสอนให้คนเติมตัวเลขท้ายรหัสเดิม
 * แล้วรู้สึกปลอดภัยขึ้นทั้งที่ไม่ได้ปลอดภัยขึ้นจริง
 */
export const MIN_PASSWORD = 8;

/** รหัสที่คนใช้ซ้ำกันมากที่สุด — ถ้าหลุดฐานข้อมูลคือเดาสำเร็จในไม่กี่ครั้ง */
const COMMON = new Set([
  "password", "12345678", "123456789", "1234567890", "qwerty123", "password1",
  "password123", "11111111", "00000000", "iloveyou", "abc12345", "admin123",
]);

export type PasswordProblem =
  | { ok: true }
  | { ok: false; message: string };

export function checkNewPassword(
  password: string,
  confirm: string,
  email: string,
): PasswordProblem {
  if (password.length < MIN_PASSWORD) {
    return { ok: false, message: `รหัสผ่านต้องยาวอย่างน้อย ${MIN_PASSWORD} ตัว` };
  }
  if (COMMON.has(password.toLowerCase())) {
    return { ok: false, message: "รหัสผ่านนี้ถูกเดาง่ายเกินไป ลองตั้งใหม่" };
  }
  /**
   * ห้ามใช้ชื่อหน้าอีเมลเป็นรหัสผ่าน — คนที่รู้อีเมลเราคือคนในครอบครัว
   * และข้อมูลในแอปนี้คือข้อมูลสุขภาพ
   */
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  if (local.length >= 4 && password.toLowerCase().includes(local)) {
    return { ok: false, message: "รหัสผ่านไม่ควรมีชื่ออีเมลของตัวเองอยู่ในนั้น" };
  }
  if (password !== confirm) {
    return { ok: false, message: "รหัสผ่านใหม่สองช่องไม่ตรงกัน" };
  }
  return { ok: true };
}
