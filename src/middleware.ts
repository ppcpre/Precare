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
const PUBLIC_PREFIXES = ["/login", "/signup", "/invite", "/api/auth"];

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
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

  return NextResponse.next();
}

export const config = {
  // ยกเว้น static asset และรูปจาก R2 ไม่ต้องผ่าน middleware
  matcher: ["/((?!_next/static|_next/image|assets|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|ico)$).*)"],
};
