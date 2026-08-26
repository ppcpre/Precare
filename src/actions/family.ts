"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { families, familyMembers, user } from "@/db/schema";
import { ownerAction, authAction, memberAction, AppError } from "@/lib/safe-action";
import { AuthzError } from "@/lib/authz";

export const renameFamily = ownerAction
  .metadata({ name: "renameFamily" })
  .inputSchema(z.object({ name: z.string().min(1).max(80) }))
  .action(async ({ parsedInput, ctx }) => {
    await ctx.db.update(families).set({ name: parsedInput.name }).where(eq(families.id, ctx.familyId));
    revalidatePath("/family");
    return { ok: true };
  });

export const changeMemberRole = ownerAction
  .metadata({ name: "changeMemberRole" })
  .inputSchema(z.object({ userId: z.string().min(1), role: z.enum(["editor", "viewer"]) }))
  .action(async ({ parsedInput, ctx }) => {
    // owner เปลี่ยน role ตัวเองไม่ได้ — ไม่งั้น family จะเหลือศูนย์ owner
    if (parsedInput.userId === ctx.user.id) throw new AppError("เปลี่ยนสิทธิ์ของตัวเองไม่ได้");
    const res = await ctx.db
      .update(familyMembers)
      .set({ role: parsedInput.role })
      .where(and(eq(familyMembers.familyId, ctx.familyId), eq(familyMembers.userId, parsedInput.userId)));
    if (!res.meta.changes) throw new AppError("ไม่พบสมาชิกคนนี้");
    revalidatePath("/family");
    return { ok: true };
  });

export const removeMember = ownerAction
  .metadata({ name: "removeMember" })
  .inputSchema(z.object({ userId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.userId === ctx.user.id) throw new AppError("นำตัวเองออกไม่ได้ ใช้การลบครอบครัวแทน");
    const res = await ctx.db.batch([
      ctx.db
        .delete(familyMembers)
        .where(and(eq(familyMembers.familyId, ctx.familyId), eq(familyMembers.userId, parsedInput.userId))),
      // เคลียร์ active family ของคนที่ถูกนำออก ไม่งั้นเขาจะค้างอยู่หน้าที่เข้าไม่ได้
      ctx.db.update(user).set({ activeFamilyId: null }).where(eq(user.id, parsedInput.userId)),
    ]);
    if (!res[0].meta.changes) throw new AppError("ไม่พบสมาชิกคนนี้");
    revalidatePath("/family");
    return { ok: true };
  });

/** owner ออกเองไม่ได้ ต้องลบ family แทน — ตรงกับ permission matrix */
export const leaveFamily = memberAction
  .metadata({ name: "leaveFamily" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    if (ctx.role === "owner") throw new AppError("เจ้าของออกจากครอบครัวไม่ได้ ให้ลบครอบครัวแทน");
    await ctx.db.batch([
      ctx.db
        .delete(familyMembers)
        .where(and(eq(familyMembers.familyId, ctx.familyId), eq(familyMembers.userId, ctx.user.id))),
      ctx.db.update(user).set({ activeFamilyId: null }).where(eq(user.id, ctx.user.id)),
    ]);
    return { ok: true };
  });

export const deleteFamily = ownerAction
  .metadata({ name: "deleteFamily" })
  // บังคับพิมพ์ชื่อครอบครัวยืนยัน ตามที่ออกแบบไว้ใน danger zone
  .inputSchema(z.object({ confirmName: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const fam = await ctx.db.select().from(families).where(eq(families.id, ctx.familyId)).get();
    if (!fam) throw new AppError("ไม่พบครอบครัวนี้");
    if (fam.name !== parsedInput.confirmName) throw new AppError("ชื่อครอบครัวไม่ตรง");

    await ctx.db.batch([
      // เคลียร์ activeFamilyId ของสมาชิกทุกคนก่อน แล้วค่อยลบ family
      // (FK เป็น ON DELETE CASCADE อยู่แล้ว แต่ user.active_family_id ไม่ใช่ FK จึงต้องเคลียร์เอง)
      ctx.db.update(user).set({ activeFamilyId: null }).where(eq(user.activeFamilyId, ctx.familyId)),
      ctx.db.delete(families).where(eq(families.id, ctx.familyId)),
    ]);
    return { ok: true };
  });

/** ใช้ตอนผู้ใช้อยู่หลาย family (เตรียมไว้ — MVP ยังบังคับ 1 active family) */
export const switchFamily = authAction
  .metadata({ name: "switchFamily" })
  .inputSchema(z.object({ familyId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const m = await ctx.db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, parsedInput.familyId),
          eq(familyMembers.userId, ctx.user.id),
          eq(familyMembers.status, "active"),
        ),
      )
      .get();
    if (!m) throw new AuthzError("NOT_A_MEMBER", 404, "ไม่พบครอบครัวนี้");
    await ctx.db.update(user).set({ activeFamilyId: parsedInput.familyId }).where(eq(user.id, ctx.user.id));
    return { ok: true };
  });
