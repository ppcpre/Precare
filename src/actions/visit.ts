"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { visitQuestions } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";

/**
 * คำถามที่อยากถามหมอ
 *
 * ไม่มีปุ่มแก้ไขข้อความโดยตั้งใจ — คำถามเป็นของสั้นที่จดเร็ว
 * ถ้าพิมพ์ผิดก็ลบแล้วจดใหม่เร็วกว่าเข้าโหมดแก้ไข
 */
const MAX_LEN = 200;
const MAX_OPEN = 30;

export const addQuestion = editorAction
  .metadata({ name: "addQuestion" })
  .inputSchema(z.object({ text: z.string().trim().min(1).max(MAX_LEN) }))
  .action(async ({ parsedInput, ctx }) => {
    // กันรายการยาวจนกลายเป็นสิ่งที่ไม่มีใครอ่านตอนอยู่ในห้องตรวจ
    // ซึ่งเป็นจุดตายของฟีเจอร์นี้ทั้งอัน
    const open = await ctx.db
      .select({ id: visitQuestions.id })
      .from(visitQuestions)
      .where(and(eq(visitQuestions.familyId, ctx.familyId), isNull(visitQuestions.askedAt)))
      .limit(MAX_OPEN);
    if (open.length >= MAX_OPEN) {
      throw new AppError(`เก็บคำถามที่ยังไม่ได้ถามได้ไม่เกิน ${MAX_OPEN} ข้อ`);
    }

    await ctx.db.insert(visitQuestions).values({
      id: crypto.randomUUID(),
      familyId: ctx.familyId,
      createdBy: ctx.user.id,
      text: parsedInput.text,
    });

    revalidatePath("/visit/questions");
    revalidatePath("/dashboard");
    return { ok: true };
  });

export const toggleAsked = editorAction
  .metadata({ name: "toggleAsked" })
  .inputSchema(z.object({ id: z.string().min(1), asked: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    // ถามแล้ว = ใส่เวลา ไม่ใช่ลบทิ้ง จะได้ย้อนดูได้ว่าเคยถามอะไรไปแล้ว
    const res = await ctx.db
      .update(visitQuestions)
      .set({ askedAt: parsedInput.asked ? new Date().toISOString() : null })
      .where(
        and(eq(visitQuestions.id, parsedInput.id), eq(visitQuestions.familyId, ctx.familyId)),
      );
    if (!res.meta.changes) throw new AppError("ไม่พบคำถามนี้");

    revalidatePath("/visit/questions");
    revalidatePath("/dashboard");
    return { ok: true };
  });

export const deleteQuestion = editorAction
  .metadata({ name: "deleteQuestion" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .delete(visitQuestions)
      .where(
        and(eq(visitQuestions.id, parsedInput.id), eq(visitQuestions.familyId, ctx.familyId)),
      );
    if (!res.meta.changes) throw new AppError("ไม่พบคำถามนี้");

    revalidatePath("/visit/questions");
    revalidatePath("/dashboard");
    return { ok: true };
  });
