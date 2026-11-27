"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appointments, careGroups, CARE_GROUP_COLORS, CLAIM_STATUSES } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import { MAX_COST_SATANG } from "@/lib/money";

/** กันคนส่งมาทีละพันแถว — ครอบครัวหนึ่งมีนัดหลักสิบ ไม่ใช่หลักพัน */
const MAX_ROWS = 200;

/**
 * บันทึกค่าใช้จ่ายหลายนัดพร้อมกัน
 *
 * ส่งทั้งหน้ามาทีเดียวแทนที่จะยิงทีละช่องตอน blur เพราะผู้ใช้กรอกรวดเดียว
 * หลายแถว การยิงทีละครั้งจะกิน D1 write ฟรีเทียร์เร็วมากโดยไม่ได้อะไรกลับมา
 *
 * costSatang เป็น null ได้ = ล้างค่ากลับไปเป็น "ยังไม่ได้ระบุ"
 * ซึ่งคนละเรื่องกับ 0 (ไปมาแล้วไม่เสียเงิน) ทั้งคู่ต้องบันทึกได้
 */
export const saveCosts = editorAction
  .metadata({ name: "saveCosts" })
  .inputSchema(
    z.object({
      rows: z
        .array(
          z.object({
            id: z.string().min(1),
            costSatang: z.number().int().min(0).max(MAX_COST_SATANG).nullable(),
            claimStatus: z.enum(CLAIM_STATUSES),
          }),
        )
        .min(1)
        .max(MAX_ROWS),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const ids = parsedInput.rows.map((r) => r.id);

    // ตรวจก่อนว่าทุก id เป็นของครอบครัวนี้จริง แล้วค่อยเขียน
    // ถ้าไล่ update ทีละแถวโดยมี familyId ใน where ก็ปลอดภัยเหมือนกัน
    // แต่จะกลืนแถวที่ไม่ใช่ของเราไปเงียบๆ แล้วผู้ใช้เห็นว่า "บันทึกแล้ว" ทั้งที่ไม่ครบ
    const owned = await ctx.db
      .select({ id: appointments.id })
      .from(appointments)
      .where(and(eq(appointments.familyId, ctx.familyId), inArray(appointments.id, ids)))
      .all();
    if (owned.length !== ids.length) throw new AppError("มีนัดหมายที่ไม่พบในครอบครัวนี้");

    for (const row of parsedInput.rows) {
      await ctx.db
        .update(appointments)
        .set({ costSatang: row.costSatang, claimStatus: row.claimStatus })
        .where(and(eq(appointments.id, row.id), eq(appointments.familyId, ctx.familyId)));
    }

    revalidatePath("/appointments");
    return { saved: parsedInput.rows.length };
  });

/** สร้างกลุ่มการรักษาใหม่ เช่น ทันตกรรม โรคประจำตัว */
export const createCareGroup = editorAction
  .metadata({ name: "createCareGroup" })
  .inputSchema(
    z.object({
      name: z.string().trim().min(1, "กรุณาตั้งชื่อกลุ่ม").max(40),
      color: z.enum(CARE_GROUP_COLORS).default("sky"),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const dup = await ctx.db
      .select({ id: careGroups.id })
      .from(careGroups)
      .where(and(eq(careGroups.familyId, ctx.familyId), eq(careGroups.name, parsedInput.name)))
      .get();
    if (dup) throw new AppError("มีกลุ่มชื่อนี้อยู่แล้ว");

    const id = crypto.randomUUID();
    await ctx.db.insert(careGroups).values({
      id,
      familyId: ctx.familyId,
      name: parsedInput.name,
      color: parsedInput.color,
    });

    revalidatePath("/appointments");
    return { id, name: parsedInput.name };
  });

/** ย้ายนัดหมายไปอีกกลุ่ม — null = เอาออกจากกลุ่ม กลับไปเป็น "ทั่วไป" */
export const setAppointmentGroup = editorAction
  .metadata({ name: "setAppointmentGroup" })
  .inputSchema(z.object({ id: z.string().min(1), groupId: z.string().min(1).nullable() }))
  .action(async ({ parsedInput, ctx }) => {
    if (parsedInput.groupId) {
      // กลุ่มต้องเป็นของครอบครัวเดียวกัน ไม่งั้นยิง id ข้ามครอบครัวได้
      const g = await ctx.db
        .select({ id: careGroups.id })
        .from(careGroups)
        .where(and(eq(careGroups.id, parsedInput.groupId), eq(careGroups.familyId, ctx.familyId)))
        .get();
      if (!g) throw new AppError("ไม่พบกลุ่มนี้");
    }

    const res = await ctx.db
      .update(appointments)
      .set({ groupId: parsedInput.groupId })
      .where(and(eq(appointments.id, parsedInput.id), eq(appointments.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบนัดหมายนี้");

    revalidatePath("/appointments");
    return { ok: true };
  });
