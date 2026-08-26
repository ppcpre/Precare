import { headers } from "next/headers";
import { and, eq, gt } from "drizzle-orm";
import { getDb } from "@/db";
import { session as sessionTable, user as userTable } from "@/db/schema";

/**
 * อ่าน session โดย **ไม่ import better-auth เข้ามาในหน้านี้**
 *
 * ทำไมต้องเลี่ยง: Turbopack/OpenNext bundle แต่ละ route แยกกัน ทุก route ที่
 * import getAuth() จะได้ better-auth ติดมาทั้งก้อน ~260 KiB gzip ต่อ route
 * ซึ่งเพดาน worker บน free plan มีแค่ 3 MiB จึงรับไม่ไหว
 *
 * วิธีตรวจ: cookie เก็บเป็น `<token>.<signature>` โดย `token` คือค่าสุ่ม 32 ตัวอักษร
 * ที่ better-auth เก็บไว้ในตาราง session — การค้นเจอแถวที่ token ตรงและยังไม่หมดอายุ
 * คือการยืนยัน session ในตัวมันเอง (token เดาไม่ได้)
 *
 * ขอบเขตที่ต้องรู้:
 * - ตรงนี้ **อ่านอย่างเดียว** ไม่ต่ออายุ session ให้ (rolling refresh)
 *   การต่ออายุยังทำโดย better-auth ที่ /api/auth/* ตามปกติ
 * - ไม่ได้ตรวจ signature ของ cookie — ป้องกันได้ด้วยตัว token ที่สุ่มอยู่แล้ว
 * - ถ้าย้ายไป Workers Paid (เพดาน 10 MiB) จะกลับไปเรียก getAuth() ตรงๆ ก็ได้
 */
export type SessionUser = {
  id: string;
  name: string;
  email: string;
  image: string | null;
  activeFamilyId: string | null;
};

/** better-auth ตั้งชื่อ cookie ต่างกันตาม protocol — https จะมี prefix __Secure- */
const COOKIE_NAMES = [
  "__Secure-better-auth.session_token",
  "better-auth.session_token",
];

export function readToken(cookieHeader: string | null): string | null {
  if (!cookieHeader) return null;
  for (const part of cookieHeader.split(";")) {
    const idx = part.indexOf("=");
    if (idx < 0) continue;
    const name = part.slice(0, idx).trim();
    if (!COOKIE_NAMES.includes(name)) continue;
    const raw = decodeURIComponent(part.slice(idx + 1).trim());
    // รูปแบบ `<token>.<signature>` — เอาเฉพาะส่วนหน้า
    return raw.split(".")[0] || null;
  }
  return null;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const token = readToken((await headers()).get("cookie"));
  if (!token) return null;

  const db = await getDb();
  const row = await db
    .select({
      id: userTable.id,
      name: userTable.name,
      email: userTable.email,
      image: userTable.image,
      activeFamilyId: userTable.activeFamilyId,
    })
    .from(sessionTable)
    .innerJoin(userTable, eq(userTable.id, sessionTable.userId))
    .where(and(eq(sessionTable.token, token), gt(sessionTable.expiresAt, new Date())))
    .get();

  return row ?? null;
}
