"use server";

import { and, eq, isNull, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { BABY_LOG_KINDS, babyReminders, children } from "@/db/schema";
import { AppError, memberAction } from "@/lib/safe-action";
import { REMIND_EVERY } from "@/lib/baby-reminder";

/**
 * การแจ้งเตือนบันทึกลูก — ของคนตั้งคนเดียว
 *
 * ใช้ memberAction ไม่ใช่ editorAction: viewer (เช่น ตายายที่ช่วยเลี้ยง) บันทึกไม่ได้
 * แต่อยากรู้ว่าถึงเวลาแล้วได้ การตั้งเตือนไม่ได้แก้ข้อมูลของครอบครัว
 *
 * ทุก query กรองด้วย user_id ของคนที่ล็อกอิน คู่กับ family_id ที่มาจาก session
 */

const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง");

const revalidate = (childId: string) => {
  revalidatePath(`/baby/${childId}/reminders`);
  revalidatePath(`/baby/${childId}/log`);
  revalidatePath("/dashboard");
};

export const saveBabyReminder = memberAction
  .metadata({ name: "saveBabyReminder" })
  .inputSchema(
    z.object({
      id: z.string().min(1).optional(),
      /** ลูกของหน้าที่เปิดอยู่ — ปั๊มนมไม่ผูกลูก แต่ใช้กลับไปหน้าเดิม */
      childId: z.string().min(1),
      kind: z.enum(BABY_LOG_KINDS),
      everyMin: z
        .number()
        .int()
        .refine((v) => (REMIND_EVERY as readonly number[]).includes(v), "เลือกช่วงเวลาจากตัวเลือก"),
      quiet: z.object({ from: hm, to: hm }).nullable(),
    }),
  )
  .action(async ({ parsedInput: p, ctx }) => {
    const child = await ctx.db
      .select({ id: children.id })
      .from(children)
      .where(and(eq(children.id, p.childId), eq(children.familyId, ctx.familyId)))
      .get();
    if (!child) throw new AppError("ไม่พบข้อมูลลูกคนนี้");
    if (p.quiet && p.quiet.from === p.quiet.to) throw new AppError("ช่วงงดเตือนต้องเริ่มกับจบคนละเวลา");

    const childId = p.kind === "pump" ? null : child.id;

    // เรื่องเดียวกันของลูกคนเดียวกันมีได้ตัวเดียวต่อคน — สองตัวคือเด้งซ้อนกันสองใบ
    const dupe = await ctx.db
      .select({ id: babyReminders.id })
      .from(babyReminders)
      .where(
        and(
          eq(babyReminders.familyId, ctx.familyId),
          eq(babyReminders.userId, ctx.user.id),
          eq(babyReminders.kind, p.kind),
          childId ? eq(babyReminders.childId, childId) : isNull(babyReminders.childId),
          p.id ? ne(babyReminders.id, p.id) : undefined,
        ),
      )
      .get();
    if (dupe) throw new AppError("ตั้งเตือนเรื่องนี้ไว้แล้ว แก้ตัวเดิมแทนได้");

    const values = {
      kind: p.kind,
      childId,
      everyMin: p.everyMin,
      quietFrom: p.quiet?.from ?? null,
      quietTo: p.quiet?.to ?? null,
      // เปลี่ยนกติกาแล้วนับรอบใหม่ — จาก 4 ชม. เป็น 2 ชม. ต้องเตือนได้จากบันทึกเดิม
      lastAnchor: null,
    };

    if (p.id) {
      const res = await ctx.db
        .update(babyReminders)
        .set(values)
        .where(
          and(
            eq(babyReminders.id, p.id),
            eq(babyReminders.familyId, ctx.familyId),
            eq(babyReminders.userId, ctx.user.id),
          ),
        )
        .returning({ id: babyReminders.id });
      if (res.length === 0) throw new AppError("ไม่พบการแจ้งเตือนนี้");
    } else {
      await ctx.db.insert(babyReminders).values({
        id: crypto.randomUUID(),
        familyId: ctx.familyId,
        userId: ctx.user.id,
        active: true,
        ...values,
      });
    }
    revalidate(child.id);
    return { ok: true };
  });

export const toggleBabyReminder = memberAction
  .metadata({ name: "toggleBabyReminder" })
  .inputSchema(z.object({ id: z.string().min(1), childId: z.string().min(1), active: z.boolean() }))
  .action(async ({ parsedInput: p, ctx }) => {
    const res = await ctx.db
      .update(babyReminders)
      .set({ active: p.active, lastAnchor: null })
      .where(
        and(
          eq(babyReminders.id, p.id),
          eq(babyReminders.familyId, ctx.familyId),
          eq(babyReminders.userId, ctx.user.id),
        ),
      )
      .returning({ id: babyReminders.id });
    if (res.length === 0) throw new AppError("ไม่พบการแจ้งเตือนนี้");
    revalidate(p.childId);
    return { ok: true };
  });

export const deleteBabyReminder = memberAction
  .metadata({ name: "deleteBabyReminder" })
  .inputSchema(z.object({ id: z.string().min(1), childId: z.string().min(1) }))
  .action(async ({ parsedInput: p, ctx }) => {
    await ctx.db
      .delete(babyReminders)
      .where(
        and(
          eq(babyReminders.id, p.id),
          eq(babyReminders.familyId, ctx.familyId),
          eq(babyReminders.userId, ctx.user.id),
        ),
      );
    revalidate(p.childId);
    return { ok: true };
  });
