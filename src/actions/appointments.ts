"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { appointmentReminders, appointments, careGroups, photos } from "@/db/schema";
import { deleteObject } from "@/lib/storage";
import { editorAction, AppError } from "@/lib/safe-action";
import type { Db } from "@/db";
import { appointmentInput, idInput } from "@/lib/validation";

const newId = () => crypto.randomUUID();

/**
 * เขียนเวลาเตือนของนัดใหม่ทั้งชุด — ลบของเดิมทิ้งก่อนเสมอ
 *
 * การลบแล้วใส่ใหม่ล้างสถานะ "เตือนแล้ว" ไปในตัว ซึ่งเป็นสิ่งที่ต้องการ:
 * แก้นัดทีไรก็ควรได้เตือนใหม่ ไม่งั้นเลื่อนนัดแล้วจะเงียบสนิท
 */
async function writeReminders(db: Db, appointmentId: string, offsets: number[]) {
  await db.delete(appointmentReminders).where(eq(appointmentReminders.appointmentId, appointmentId));
  if (offsets.length === 0) return;
  await db.insert(appointmentReminders).values(
    offsets.map((minutesBefore) => ({ id: newId(), appointmentId, minutesBefore })),
  );
}

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
    const { reminderOffsets, ...fields } = parsedInput;
    await assertGroupOwned(ctx.db, ctx.familyId, fields.groupId);
    const id = newId();
    await ctx.db.insert(appointments).values({
      ...fields,
      id,
      familyId: ctx.familyId,
      createdBy: ctx.user.id,
    });
    await writeReminders(ctx.db, id, reminderOffsets);
    revalidatePath("/appointments");
    revalidatePath("/dashboard");
    return { ok: true };
  });

export const updateAppointment = editorAction
  .metadata({ name: "updateAppointment" })
  .inputSchema(appointmentInput.extend({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const { id, reminderOffsets, ...rest } = parsedInput;
    await assertGroupOwned(ctx.db, ctx.familyId, rest.groupId);
    const res = await ctx.db
      .update(appointments)
      .set(rest)
      .where(and(eq(appointments.id, id), eq(appointments.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบนัดหมายนี้");
    // เขียนใหม่ทั้งชุด ซึ่งล้างสถานะ "เตือนแล้ว" ไปด้วย (ดู writeReminders)
    await writeReminders(ctx.db, id, reminderOffsets);
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
