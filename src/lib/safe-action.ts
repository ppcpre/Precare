/**
 * Action client + authz middleware
 *
 * นี่คือจุดที่ทำให้กติกา "ทุก query ต้องเช็ค session + role ก่อนแตะ D1"
 * กลายเป็นสิ่งที่ **ลืมไม่ได้เชิงโครงสร้าง** แทนที่จะเป็นสิ่งที่ต้องจำ
 *
 * ห้ามสร้าง action ที่แตะข้อมูลของ family โดยไม่ผ่าน memberAction/editorAction/ownerAction
 */
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { headers } from "next/headers";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { getAuth } from "@/lib/auth";
import { AuthzError, requireRole } from "@/lib/authz";
import type { Role } from "@/types";

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export const actionClient = createSafeActionClient({
  handleServerError(e) {
    // ข้อความที่ตั้งใจให้ผู้ใช้เห็นเท่านั้นที่ส่งกลับไป
    if (e instanceof AuthzError || e instanceof AppError) return e.message;
    console.error("[action] unhandled:", e);
    return DEFAULT_SERVER_ERROR_MESSAGE;
  },
  defineMetadataSchema: () => z.object({ name: z.string() }).optional(),
});

/** ชั้นที่ 1 — ต้องล็อกอิน */
export const authAction = actionClient.use(async ({ next }) => {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new AuthzError("NOT_A_MEMBER", 403, "กรุณาเข้าสู่ระบบ");
  const db = await getDb();
  return next({ ctx: { db, user: session.user, session: session.session } });
});

/**
 * ชั้นที่ 2 — ต้องเป็นสมาชิกของ active family อย่างน้อยระดับ `min`
 *
 * ใช้ activeFamilyId จาก session ไม่ใช่จาก input ของ client
 * ถ้ารับ familyId จาก client จะเปิดช่องให้ยิงข้าม family ได้
 */
function withRole(min: Role) {
  return authAction.use(async ({ next, ctx }) => {
    const familyId = ctx.user.activeFamilyId;
    if (!familyId) throw new AppError("ยังไม่ได้ตั้งค่าครอบครัว");
    const role = await requireRole(ctx.db as Db, familyId, ctx.user.id, min);
    return next({ ctx: { ...ctx, familyId, role } });
  });
}

/** อ่านอย่างเดียวก็ต้องเป็นสมาชิก — คนนอกห้ามเห็นอะไรเลย */
export const memberAction = withRole("viewer");
/** เพิ่ม/แก้/ลบ บันทึกสุขภาพ นัดหมาย รูป */
export const editorAction = withRole("editor");
/** แก้วันตั้งครรภ์ จัดการสมาชิก ลบ family */
export const ownerAction = withRole("owner");
