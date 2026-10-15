import { NextResponse } from "next/server";

/**
 * ล้างคุกกี้ session ที่ใช้ไม่ได้แล้ว แล้วพาไปหน้าเข้าสู่ระบบ
 *
 * มีเพราะคุกกี้กับแถวในฐานข้อมูลหลุดจากกันได้ — เปลี่ยนรหัสผ่านแล้วเครื่องอื่น
 * ถูกถอน session, session หมดอายุ, หรือแอดมินลบทิ้ง เครื่องนั้นยังถือคุกกี้ไว้
 *
 * ของเดิมติดลูป: /dashboard เห็นว่าไม่มี session จริงจึงส่งไป /login
 * แต่ middleware เห็นว่า "ยังมีคุกกี้" จึงส่งกลับมา /dashboard วนไปเรื่อยๆ
 * ผู้ใช้เข้าหน้า login ไม่ได้เลยจนกว่าจะล้างข้อมูลเบราว์เซอร์เอง
 *
 * ต้องเป็น route handler เพราะ server component ลบคุกกี้ไม่ได้ (อ่านได้อย่างเดียว)
 */
const COOKIES = ["__Secure-better-auth.session_token", "better-auth.session_token"];

export function GET(req: Request) {
  const url = new URL("/login?stale=1", req.url);
  const res = NextResponse.redirect(url);
  // ลบทั้งสองชื่อ เพราะชื่อต่างกันระหว่าง http (dev) กับ https (production)
  for (const name of COOKIES) res.cookies.set(name, "", { path: "/", maxAge: 0 });
  return res;
}
