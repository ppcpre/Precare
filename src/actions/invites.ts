"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { familyInvites, familyMembers, families, user } from "@/db/schema";
import { ownerAction, authAction, AppError } from "@/lib/safe-action";
import type { Db } from "@/db";
import { inviteInput, idInput } from "@/lib/validation";

const newId = () => crypto.randomUUID();
const INVITE_TTL_DAYS = 7;

export const createInvite = ownerAction
  .metadata({ name: "createInvite" })
  .inputSchema(inviteInput)
  .action(async ({ parsedInput, ctx }) => {
    const email = parsedInput.email.trim().toLowerCase();

    // เชิญคนที่เป็นสมาชิกอยู่แล้วไม่ได้
    const existing = await ctx.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .innerJoin(user, eq(user.id, familyMembers.userId))
      .where(and(eq(familyMembers.familyId, ctx.familyId), eq(user.email, email)))
      .get();
    if (existing) throw new AppError("อีเมลนี้เป็นสมาชิกอยู่แล้ว");

    const id = newId();
    const expiresAt = new Date(Date.now() + INVITE_TTL_DAYS * 86400_000).toISOString();

    await ctx.db.batch([
      // ยกเลิกคำเชิญเก่าที่ยังค้างของอีเมลเดียวกัน กันมีลิงก์ใช้ได้หลายอัน
      ctx.db
        .update(familyInvites)
        .set({ status: "expired" })
        .where(
          and(
            eq(familyInvites.familyId, ctx.familyId),
            eq(familyInvites.invitedEmail, email),
            eq(familyInvites.status, "pending"),
          ),
        ),
      ctx.db.insert(familyInvites).values({
        id,
        familyId: ctx.familyId,
        invitedEmail: email,
        invitedRole: parsedInput.role,
        invitedBy: ctx.user.id,
        expiresAt,
      }),
    ]);

    revalidatePath("/family");
    // Phase 1 — owner คัดลอกลิงก์ส่งเอง · Phase 1.5 ระบบส่งอีเมลให้
    return { inviteId: id, expiresAt };
  });

export const cancelInvite = ownerAction
  .metadata({ name: "cancelInvite" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .update(familyInvites)
      .set({ status: "expired" })
      .where(and(eq(familyInvites.id, parsedInput.id), eq(familyInvites.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบคำเชิญนี้");
    revalidatePath("/family");
    return { ok: true };
  });

/** อ่านข้อมูลคำเชิญเพื่อโชว์บนหน้า /invite/[token] — ยังไม่ผูกกับ family ใดๆ */
export const acceptInvite = authAction
  .metadata({ name: "acceptInvite" })
  .inputSchema(z.object({ token: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const inv = await ctx.db
      .select()
      .from(familyInvites)
      .where(eq(familyInvites.id, parsedInput.token))
      .get();

    if (!inv || inv.status !== "pending") throw new AppError("คำเชิญนี้ใช้ไม่ได้แล้ว");
    if (new Date(inv.expiresAt) < new Date()) {
      await ctx.db.update(familyInvites).set({ status: "expired" }).where(eq(familyInvites.id, inv.id));
      throw new AppError("คำเชิญหมดอายุแล้ว");
    }
    // ต้องเป็นอีเมลเดียวกับที่ถูกเชิญ ไม่งั้นใครได้ลิงก์ไปก็เข้าได้หมด
    if (inv.invitedEmail !== ctx.user.email.toLowerCase()) {
      throw new AppError("คำเชิญนี้ส่งถึงอีเมลอื่น กรุณาเข้าสู่ระบบด้วยอีเมลที่ได้รับเชิญ");
    }

    const already = await ctx.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, inv.familyId), eq(familyMembers.userId, ctx.user.id)))
      .get();

    await ctx.db.batch([
      already
        ? ctx.db.update(familyMembers).set({ status: "active" }).where(eq(familyMembers.id, already.id))
        : ctx.db.insert(familyMembers).values({
            id: newId(),
            familyId: inv.familyId,
            userId: ctx.user.id,
            role: inv.invitedRole,
            status: "active",
          }),
      ctx.db.update(familyInvites).set({ status: "accepted" }).where(eq(familyInvites.id, inv.id)),
      ctx.db.update(user).set({ activeFamilyId: inv.familyId }).where(eq(user.id, ctx.user.id)),
    ]);

    return { familyId: inv.familyId };
  });

/** ข้อมูลย่อสำหรับแสดงบนหน้า /invite/[token] ก่อนกดรับ */
export async function getInvitePreview(db: Db, token: string) {
  return db
    .select({
      id: familyInvites.id,
      role: familyInvites.invitedRole,
      status: familyInvites.status,
      expiresAt: familyInvites.expiresAt,
      email: familyInvites.invitedEmail,
      familyName: families.name,
      inviterName: user.name,
      isExpired: sql<number>`CASE WHEN datetime(${familyInvites.expiresAt}) < datetime('now') THEN 1 ELSE 0 END`,
    })
    .from(familyInvites)
    .innerJoin(families, eq(families.id, familyInvites.familyId))
    .innerJoin(user, eq(user.id, familyInvites.invitedBy))
    .where(eq(familyInvites.id, token))
    .get();
}
