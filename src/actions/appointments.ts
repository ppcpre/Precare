"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appointments, careGroups } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import type { Db } from "@/db";
import { appointmentInput, idInput } from "@/lib/validation";

const newId = () => crypto.randomUUID();

/**
 * groupId มาจาก client จึงเชื่อไม่ได้ ต้องยืนยันว่าเป็นกลุ่มของครอบครัวนี้จริง
 * ไม่งั้นยิง id ของครอบครัวอื่นมาผูกได้ แล้วชื่อกลุ่มของเขาจะโผล่ในหน้าเรา
 */
async function assertGroupOwned(
  db: Db,
  familyId: string,
  groupId: string | null | undefined,
) {
  if (!groupId) return;
  const g = await db
    .select({ id: careGroups.id })
    .from(careGroups)
    .where(and(eq(careGroups.id, groupId), eq(careGroups.familyId, familyId)))
    .get();
  if (!g) throw new AppError("ไม่พบกลุ่มการรักษานี้");
}

export const createAppointment = editorAction
  .metadata({ name: "createAppointment" })
  .inputSchema(appointmentInput)
  .action(async ({ parsedInput, ctx }) => {
    await assertGroupOwned(ctx.db, ctx.familyId, parsedInput.groupId);
    await ctx.db.insert(appointments).values({
      ...parsedInput,
      id: newId(),
      familyId: ctx.familyId,
      createdBy: ctx.user.id,
    });
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { ok: true };
  });

export const updateAppointment = editorAction
  .metadata({ name: "updateAppointment" })
  .inputSchema(appointmentInput.extend({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...rest } = parsedInput;
    await assertGroupOwned(ctx.db, ctx.familyId, rest.groupId);
    const res = await ctx.db
      .update(appointments)
      .set(rest)
      .where(and(eq(appointments.id, id), eq(appointments.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบนัดหมายนี้");
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { ok: true };
  });

export const deleteAppointment = editorAction
  .metadata({ name: "deleteAppointment" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .delete(appointments)
      .where(and(eq(appointments.id, parsedInput.id), eq(appointments.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบนัดหมายนี้");
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { ok: true };
  });
