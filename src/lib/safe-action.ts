/**
 * Action client + authz middleware
 *
 * นี่คือจุดที่ทำให้กติกา "ทุก query ต้องเช็ค session + role ก่อนแตะ D1"
 * กลายเป็นสิ่งที่ **ลืมไม่ได้เชิงโครงสร้าง** แทนที่จะเป็นสิ่งที่ต้องจำ
 *
 * ห้ามสร้าง action ที่แตะข้อมูลของ family โดยไม่ผ่าน memberAction/editorAction/ownerAction
 */
import { createSafeActionClient, DEFAULT_SERVER_ERROR_MESSAGE } from "next-safe-action";
import { z } from "zod";
import { getDb, type Db } from "@/db";
import { getSessionUser } from "@/lib/session";
import { AuthzError, requireRole } from "@/lib/authz";
import type { Role } from "@/types";

export class AppError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AppError";
  }
}

export const actionClient = createSafeActionClient({
  /**
   * T6.5 — ให้ error บน production ตามรอยได้
   *
   * เดิม log แค่ตัว error เปล่าๆ พอมีคนแจ้งว่า "กดแล้วขึ้นระบบขัดข้อง"
   * เราไม่รู้เลยว่า action ไหน ใคร หรือตอนไหน ต้องไล่เดาจาก wrangler tail
   *
   * ตอนนี้แนบรหัสสั้นๆ ไปกับข้อความที่ผู้ใช้เห็น แล้ว log รหัสเดียวกันไว้
   * ผู้ใช้บอกรหัสมา เรา grep เจอทันทีว่าเกิดอะไรขึ้น
   *
   * ⚠️ ห้าม log clientInput — ในนั้นมีน้ำหนัก ความดัน บันทึกอาการ
   *    ซึ่งเป็นข้อมูลสุขภาพ log ของ Cloudflare ไม่ใช่ที่เก็บของพวกนี้
   */
  handleServerError(e, { metadata, ctx }) {
    // ข้อความที่ตั้งใจให้ผู้ใช้เห็นเท่านั้นที่ส่งกลับไป
    if (e instanceof AuthzError || e instanceof AppError) return e.message;

    const ref = crypto.randomUUID().slice(0, 6);
    console.error(
      JSON.stringify({
        tag: "action-error",
        ref,
        action: metadata?.name ?? "unknown",
        userId: (ctx as { user?: { id: string } } | undefined)?.user?.id ?? null,
        error: e.name,
        message: e.message,
        stack: e.stack?.split("\n").slice(0, 5).join(" | "),
      }),
    );
    return `${DEFAULT_SERVER_ERROR_MESSAGE} (รหัสอ้างอิง ${ref})`;
  },
  defineMetadataSchema: () => z.object({ name: z.string() }).optional(),
});

/** ชั้นที่ 1 — ต้องล็อกอิน */
export const authAction = actionClient.use(async ({ next }) => {
  // ใช้ getSessionUser() ที่ยิง API แทนการ import better-auth ตรงๆ
  // ไม่งั้นทุก route ที่มี Server Action จะได้ better-auth ติดมาทั้งก้อน (~260 KiB/route)
  const user = await getSessionUser();
  if (!user) throw new AuthzError("NOT_A_MEMBER", 403, "กรุณาเข้าสู่ระบบ");
  const db = await getDb();
  return next({ ctx: { db, user } });
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
