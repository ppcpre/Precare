"use server";

import { and, desc, eq, inArray, isNull, ne } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { consents, families, familyMembers, user } from "@/db/schema";
import { authAction, AppError } from "@/lib/safe-action";
import { deleteFamilyFiles, deleteUserFiles } from "@/lib/storage";
import { CONSENT_KINDS, POLICY_VERSION, REQUIRED_KINDS, type ConsentKind } from "@/lib/consent";

/**
 * บันทึกความยินยอมตอนสมัคร
 *
 * เรียกหลังสมัครสำเร็จ (มี session แล้ว) ไม่ใช่ก่อน — ตอนก่อนสมัครยังไม่มี userId
 * ให้ผูก และการเก็บความยินยอมของคนที่สมัครไม่สำเร็จก็ไม่มีประโยชน์
 *
 * ทำซ้ำได้โดยไม่เกิดแถวซ้ำ เผื่อกรณีที่การเรียกครั้งแรกล้มกลางทาง
 */
export const recordConsents = authAction
  .metadata({ name: "recordConsents" })
  .inputSchema(
    z.object({
      granted: z.array(z.enum(CONSENT_KINDS)).max(CONSENT_KINDS.length),
      version: z.string().min(1).max(40),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    // ข้อบังคับต้องมาครบ ไม่งั้นแปลว่าฝั่งหน้าจอถูกข้ามไป
    for (const k of REQUIRED_KINDS) {
      if (!parsedInput.granted.includes(k)) throw new AppError("ยังยินยอมไม่ครบข้อที่จำเป็น");
    }

    const existing = await ctx.db
      .select({ kind: consents.kind })
      .from(consents)
      .where(
        and(
          eq(consents.userId, ctx.user.id),
          eq(consents.version, parsedInput.version),
          isNull(consents.revokedAt),
        ),
      );
    const have = new Set(existing.map((e) => e.kind));

    const rows = parsedInput.granted
      .filter((k) => !have.has(k))
      .map((kind) => ({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        kind,
        version: parsedInput.version,
      }));
    if (rows.length) await ctx.db.insert(consents).values(rows);

    return { saved: rows.length };
  });

/**
 * เปิด/ปิดความยินยอมที่ไม่บังคับ
 *
 * ข้อที่บังคับถอนตรงนี้ไม่ได้ — การถอนความยินยอมเรื่องข้อมูลสุขภาพแปลว่า
 * ใช้แอปต่อไม่ได้เลย เพราะทั้งแอปทำงานบนข้อมูลนั้น จึงต้องไปทางลบบัญชี
 * ซึ่งตรงไปตรงมากว่าการปล่อยให้ล็อกอินได้แต่ใช้อะไรไม่ได้
 */
export const setOptionalConsent = authAction
  .metadata({ name: "setOptionalConsent" })
  .inputSchema(z.object({ kind: z.enum(CONSENT_KINDS), granted: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    if (REQUIRED_KINDS.includes(parsedInput.kind as ConsentKind)) {
      throw new AppError("ข้อนี้จำเป็นต่อการใช้งาน ถ้าต้องการถอนให้ลบบัญชีแทน");
    }

    if (parsedInput.granted) {
      await ctx.db.insert(consents).values({
        id: crypto.randomUUID(),
        userId: ctx.user.id,
        kind: parsedInput.kind,
        version: POLICY_VERSION,
      });
    } else {
      // ถอน = ใส่เวลาถอน ไม่ลบแถว ไม่งั้นพิสูจน์ย้อนหลังไม่ได้ว่าเคยยินยอม
      await ctx.db
        .update(consents)
        .set({ revokedAt: new Date().toISOString() })
        .where(
          and(
            eq(consents.userId, ctx.user.id),
            eq(consents.kind, parsedInput.kind),
            isNull(consents.revokedAt),
          ),
        );
    }
    return { ok: true };
  });

/**
 * ลบบัญชีและข้อมูลทั้งหมด — **ลบทันทีและถาวร ไม่มีช่วงกู้คืน**
 *
 * ทำไมไม่ทำ soft delete 30 วันตามที่ดีไซน์เขียนไว้: การทำแบบนั้นต้องมีงาน
 * เบื้องหลังคอยลบของที่ครบกำหนด ซึ่งโปรเจกต์นี้ยังไม่มี การเขียนว่า
 * "ลบใน 30 วัน" ทั้งที่ไม่มีอะไรมาลบให้ คือคำสัญญาที่โค้ดทำไม่ได้
 *
 * ลำดับสำคัญ: **ลบไฟล์ใน R2 ก่อนลบแถวเสมอ**
 * พอลบ family/user แล้ว storage_objects จะ cascade หายไป แล้วจะไม่เหลือ
 * อะไรบอกว่าไฟล์ไหนเป็นของใคร ไฟล์จะค้างกินโควตาที่ใช้ร่วมกันตลอดไป
 *
 * แถว consents ไม่ถูกลบโดยตั้งใจ — ดูเหตุผลใน src/db/schema/app.ts
 */
export const deleteAccount = authAction
  .metadata({ name: "deleteAccount" })
  .inputSchema(z.object({ confirmEmail: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.confirmEmail.trim().toLowerCase() !== ctx.user.email.toLowerCase()) {
      throw new AppError("อีเมลไม่ตรงกับบัญชีนี้");
    }

    const memberships = await ctx.db
      .select({ familyId: familyMembers.familyId, role: familyMembers.role })
      .from(familyMembers)
      .where(
        and(eq(familyMembers.userId, ctx.user.id), eq(familyMembers.status, "active")),
      );

    /**
     * ครอบครัวที่เป็นเจ้าของและยังมีคนอื่นอยู่ ลบไม่ได้
     *
     * ปล่อยให้ครอบครัวไม่มีเจ้าของไม่ได้ เพราะจะไม่มีใครเชิญหรือถอดสมาชิกได้อีก
     * และการลบครอบครัวทิ้งไปเลยก็เท่ากับลบข้อมูลของคนอื่นด้วย ซึ่งไม่ใช่สิทธิ์ของเรา
     */
    const owned = memberships.filter((m) => m.role === "owner").map((m) => m.familyId);
    if (owned.length) {
      const others = await ctx.db
        .select({ familyId: familyMembers.familyId })
        .from(familyMembers)
        .where(
          and(
            inArray(familyMembers.familyId, owned),
            ne(familyMembers.userId, ctx.user.id),
            eq(familyMembers.status, "active"),
          ),
        );
      if (others.length) {
        throw new AppError(
          "คุณเป็นเจ้าของครอบครัวที่ยังมีสมาชิกคนอื่นอยู่ ต้องโอนสิทธิ์เจ้าของ หรือลบครอบครัวก่อน",
        );
      }
    }

    const { env } = await getCloudflareContext({ async: true });
    for (const familyId of owned) {
      await deleteFamilyFiles(ctx.db, env.PHOTOS_BUCKET, familyId);
    }
    await deleteUserFiles(ctx.db, env.PHOTOS_BUCKET, ctx.user.id);

    // ครอบครัวที่เป็นเจ้าของคนเดียว ลบทั้งก้อน (cascade เก็บที่เหลือให้)
    // แยกออกมาจาก batch เพราะอาจไม่มีเลย และ batch ต้องมีอย่างน้อยหนึ่ง statement
    if (owned.length) {
      await ctx.db.delete(families).where(inArray(families.id, owned));
    }

    await ctx.db.batch([
      // ครอบครัวที่เป็นสมาชิกคนอื่น ถอนตัวเองออก ข้อมูลของเขายังอยู่
      ctx.db.delete(familyMembers).where(eq(familyMembers.userId, ctx.user.id)),
      // ลบ user เป็นอันดับสุดท้าย — session/account ผูกด้วย FK cascade ของ better-auth
      ctx.db.delete(user).where(eq(user.id, ctx.user.id)),
    ]);

    return { ok: true };
  });

/** ความยินยอมที่ยังมีผลอยู่ของผู้ใช้คนนี้ */
export const currentConsents = authAction
  .metadata({ name: "currentConsents" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const rows = await ctx.db
      .select({
        kind: consents.kind,
        version: consents.version,
        grantedAt: consents.grantedAt,
      })
      .from(consents)
      .where(and(eq(consents.userId, ctx.user.id), isNull(consents.revokedAt)))
      .orderBy(desc(consents.grantedAt));
    return { rows };
  });
