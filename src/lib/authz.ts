/**
 * Authorization — จุดสำคัญที่สุดของระบบนี้
 *
 * D1 ไม่มี row-level security แบบ Firestore rules ทุกอย่างจึงพึ่งโค้ดตรงนี้ 100%
 * ถ้าฟังก์ชันในไฟล์นี้พลาด = viewer ลบข้อมูลคนอื่นได้
 *
 * กติกา: ห้าม query ตารางที่ผูกกับ family โดยไม่ผ่าน requireRole() ก่อน
 * M3 จะห่อไฟล์นี้เป็น middleware ของ next-safe-action เพื่อให้ "ลืมไม่ได้เชิงโครงสร้าง"
 */
import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { familyMembers } from "@/db/schema";
import type { Role } from "@/types";

/** owner ทำได้ทุกอย่างที่ editor ทำได้ · editor ทำได้ทุกอย่างที่ viewer ทำได้ */
const RANK: Record<Role, number> = { viewer: 0, editor: 1, owner: 2 };

export class AuthzError extends Error {
  constructor(
    readonly code: "NOT_A_MEMBER" | "INSUFFICIENT_ROLE",
    readonly status: 403 | 404 = 403,
    message?: string,
  ) {
    super(message ?? code);
    this.name = "AuthzError";
  }
}

/** คืน role ของ user ใน family นั้น หรือ null ถ้าไม่ได้เป็นสมาชิก (active) */
export async function getMembership(
  db: Db,
  familyId: string,
  userId: string,
): Promise<Role | null> {
  const row = await db
    .select({ role: familyMembers.role })
    .from(familyMembers)
    .where(
      and(
        eq(familyMembers.familyId, familyId),
        eq(familyMembers.userId, userId),
        eq(familyMembers.status, "active"),
      ),
    )
    .get();
  return row?.role ?? null;
}

/**
 * เช็คว่า user มีสิทธิ์อย่างน้อยระดับ `min` ใน family นี้ไหม
 * ไม่ผ่าน = โยน AuthzError ไม่ใช่คืน false — กันเผลอเขียน `if (!ok)` แล้วลืม return
 */
export async function requireRole(
  db: Db,
  familyId: string,
  userId: string,
  min: Role,
): Promise<Role> {
  const role = await getMembership(db, familyId, userId);
  if (!role) {
    // 404 ไม่ใช่ 403 — คนนอกไม่ควรรู้ด้วยซ้ำว่า family นี้มีอยู่จริง
    throw new AuthzError("NOT_A_MEMBER", 404, "ไม่พบครอบครัวนี้");
  }
  if (RANK[role] < RANK[min]) {
    throw new AuthzError(
      "INSUFFICIENT_ROLE",
      403,
      `ต้องมีสิทธิ์ระดับ ${min} ขึ้นไป (ตอนนี้เป็น ${role})`,
    );
  }
  return role;
}

/** ใช้ตอน render UI เพื่อ "ซ่อน" ปุ่ม — ไม่ใช่ใช้แทน requireRole ตอนเขียนข้อมูล */
export const can = {
  read:            (r: Role | null): r is Role => r !== null,
  writeRecords:    (r: Role | null) => r === "owner" || r === "editor",
  editPregnancy:   (r: Role | null) => r === "owner",
  manageMembers:   (r: Role | null) => r === "owner",
  deleteFamily:    (r: Role | null) => r === "owner",
  leaveFamily:     (r: Role | null) => r === "editor" || r === "viewer",
} as const;
