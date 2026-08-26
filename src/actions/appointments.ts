"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appointments } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import { appointmentInput, idInput } from "@/lib/validation";

const newId = () => crypto.randomUUID();

export const createAppointment = editorAction
  .metadata({ name: "createAppointment" })
  .inputSchema(appointmentInput)
  .action(async ({ parsedInput, ctx }) => {
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
