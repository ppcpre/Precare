"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { weeklyLogs } from "@/db/schema";
import { editorAction, memberAction, AppError } from "@/lib/safe-action";
import { weeklyLogInput, idInput } from "@/lib/validation";
import { stringifySymptoms } from "@/types";

const newId = () => crypto.randomUUID();

export const createWeeklyLog = editorAction
  .metadata({ name: "createWeeklyLog" })
  .inputSchema(weeklyLogInput)
  .action(async ({ parsedInput, ctx }) => {
    const { symptoms, ...rest } = parsedInput;
    const id = newId();
    await ctx.db.insert(weeklyLogs).values({
      ...rest,
      id,
      familyId: ctx.familyId,       // จาก session ไม่ใช่จาก client
      recordedBy: ctx.user.id,
      symptoms: stringifySymptoms(symptoms),
    });
    revalidatePath("/health");
    revalidatePath("/dashboard");
    // คืน id เพื่อให้ฟอร์มพาไปหน้าเพิ่มรูปต่อได้ทันที
    return { id };
  });

export const updateWeeklyLog = editorAction
  .metadata({ name: "updateWeeklyLog" })
  .inputSchema(weeklyLogInput.extend({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const { id, symptoms, ...rest } = parsedInput;
    const res = await ctx.db
      .update(weeklyLogs)
      .set({ ...rest, symptoms: stringifySymptoms(symptoms) })
      // เงื่อนไข familyId สำคัญมาก — กันแก้บันทึกของครอบครัวอื่นด้วยการเดา id
      .where(and(eq(weeklyLogs.id, id), eq(weeklyLogs.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบบันทึกนี้");
    revalidatePath("/health");
    revalidatePath("/dashboard");
    return { ok: true };
  });

export const deleteWeeklyLog = editorAction
  .metadata({ name: "deleteWeeklyLog" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .delete(weeklyLogs)
      .where(and(eq(weeklyLogs.id, parsedInput.id), eq(weeklyLogs.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบบันทึกนี้");
    revalidatePath("/health");
    revalidatePath("/dashboard");
    return { ok: true };
  });

/** viewer อ่านได้ แต่เขียนไม่ได้ — จึงใช้ memberAction ไม่ใช่ editorAction */
export const getWeeklyLog = memberAction
  .metadata({ name: "getWeeklyLog" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    const row = await ctx.db
      .select()
      .from(weeklyLogs)
      .where(and(eq(weeklyLogs.id, parsedInput.id), eq(weeklyLogs.familyId, ctx.familyId)))
      .get();
    if (!row) throw new AppError("ไม่พบบันทึกนี้");
    return row;
  });
