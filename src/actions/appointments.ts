"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { appointments, careGroups, photos } from "@/db/schema";
import { deleteObject } from "@/lib/storage";
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
      // ล้างเครื่องหมาย "เตือนไปแล้ว" ทุกครั้งที่แก้นัด
      // เลื่อนนัดไปวันอื่นแล้วไม่ล้าง = นัดใหม่จะไม่มีเตือนเลย
      .set({ ...rest, reminderSentAt: null })
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
    /**
     * ลบใบเสร็จของนัดก่อนลบนัด
     *
     * รูปทั่วไปที่แนบกับนัดยังอยู่ในอัลบั้มหลังลบนัด (FK เป็น set null) ซึ่งถูกแล้ว
     * แต่ใบเสร็จไม่ขึ้นในอัลบั้ม ถ้าปล่อยตามกฎเดียวกัน มันจะกลายเป็นไฟล์ที่
     * ไม่มีหน้าไหนแสดงเลยแต่ยังกินโควตา — และในแง่ข้อมูลส่วนตัว
     * เอกสารที่มีชื่อคนไข้ไม่ควรค้างอยู่หลังเจ้าของลบสิ่งที่มันผูกอยู่ไปแล้ว
     */
    const receipts = await ctx.db
      .select({ id: photos.id, r2Key: photos.r2Key })
      .from(photos)
      .where(
        and(
          eq(photos.familyId, ctx.familyId),
          eq(photos.appointmentId, parsedInput.id),
          eq(photos.type, "receipt"),
        ),
      );
    if (receipts.length) {
      const { env } = await getCloudflareContext({ async: true });
      for (const r of receipts) await deleteObject(ctx.db, env.PHOTOS_BUCKET, r.r2Key);
      await ctx.db
        .delete(photos)
        .where(
          and(
            eq(photos.familyId, ctx.familyId),
            eq(photos.appointmentId, parsedInput.id),
            eq(photos.type, "receipt"),
          ),
        );
    }

    const res = await ctx.db
      .delete(appointments)
      .where(and(eq(appointments.id, parsedInput.id), eq(appointments.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบนัดหมายนี้");
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { ok: true };
  });
