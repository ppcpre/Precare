import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

/**
 * T2.6 — กันเข้าหน้าที่ต้องล็อกอิน
 *
 * ⚠️ Next.js 16 บอกให้ย้ายไป proxy.ts แต่ **ห้ามย้ายในโปรเจกต์นี้**
 *    proxy บังคับ runtime = nodejs ซึ่ง @opennextjs/cloudflare ยังไม่รองรับ
 *    (build จะ error: "Node.js middleware is not currently supported")
 *    middleware.ts = edge runtime ยังใช้ได้ปกติ ให้คงไว้จนกว่า OpenNext จะรองรับ
 *
 * ⚠️ ตรงนี้เช็คแค่ว่า "มี cookie session ไหม" ไม่ได้ยืนยันกับ DB
 *    เพราะ middleware รันทุก request การยิง D1 ทุกครั้งจะเปลืองโควตาและช้า
 *    เป็นแค่ optimistic redirect เพื่อ UX เท่านั้น
 *
 * ⚠️ ห้ามใช้ตรงนี้แทน authz จริง — การเช็คสิทธิ์ที่เชื่อถือได้อยู่ที่
 *    requireRole() ใน RSC และ Server Action ซึ่งคุยกับ D1 จริงเสมอ
 */
// /api/asset เป็นภาพประกอบของระบบล้วน ไม่มีข้อมูลผู้ใช้ ปล่อยให้ CDN cache ได้
// (ของผู้ใช้อยู่ที่ /api/media ซึ่งไม่อยู่ในลิสต์นี้และเช็คสิทธิ์เองในตัว route)
const PUBLIC_PREFIXES = ["/login", "/signup", "/invite", "/api/auth", "/api/asset"];

/**
 * T6.5 — CSP แบบมี nonce
 *
 * เดิมมีแค่ frame-ancestors ใน next.config.ts เพราะ CSP เต็มรูปแบบต้องใช้
 * nonce ซึ่งต้องสร้างใหม่ทุก request จึงทำใน next.config ไม่ได้
 * middleware เป็นที่เดียวที่ทำได้ และ Next จะหยิบ nonce ไปใส่ script ของตัวเอง
 * ให้อัตโนมัติเมื่อเห็น header นี้บน request
 *
 * ที่ต้องผ่อนเป็นข้อๆ
 * - style-src 'unsafe-inline': Next ฝัง <style> ของตัวเองและโค้ดเรามี
 *   style={{...}} อยู่ใน global-error.tsx (ซึ่งต้องทำงานได้แม้ CSS พัง)
 *   การใส่ nonce ให้ style ทุกจุดไม่คุ้มกับที่ได้ เพราะ style ก่อ XSS ได้ยาก
 * - img-src blob:: หน้าอัลบั้มแสดง preview จาก URL.createObjectURL ก่อนอัปโหลด
 * - connect-src 'self': Server Action ยิงกลับ origin เดิมเท่านั้น
 *
 * strict-dynamic ทำให้ script ที่ script ที่มี nonce โหลดต่อ เชื่อถือตามไปด้วย
 * ซึ่งจำเป็นกับ chunk ของ Next ที่โหลดกันเป็นทอดๆ
 */
function buildCsp(nonce: string) {
  return [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "object-src 'none'",
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const csp = buildCsp(nonce);
  const isPublic = PUBLIC_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(p + "/"),
  );
  const hasSession = Boolean(getSessionCookie(req));

  if (!hasSession && !isPublic) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    // จำหน้าที่ตั้งใจจะไป เพื่อพากลับมาหลังล็อกอิน
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // ล็อกอินแล้วแต่ยังวนอยู่หน้า login/signup -> พาเข้าแอป
  if (hasSession && (pathname === "/login" || pathname === "/signup")) {
    const url = req.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Next อ่าน x-nonce จาก request เพื่อใส่ให้ script ของตัวเอง
  // จึงต้องส่งต่อ header นี้เข้าไปใน request ไม่ใช่แค่ตอบกลับใน response
  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);

  const res = NextResponse.next({ request: { headers } });
  res.headers.set("content-security-policy", csp);
  return res;
}

export const config = {
  // ยกเว้น static asset และรูปจาก R2 ไม่ต้องผ่าน middleware
  matcher: ["/((?!_next/static|_next/image|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
