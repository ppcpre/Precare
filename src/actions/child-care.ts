"use server";

import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Db } from "@/db";
import { CHILD_MED_MODES, TEMP_SITES, childMedDoses, childMeds, childTemps, children, user } from "@/db/schema";
import { AppError, editorAction } from "@/lib/safe-action";
import { localNowIso } from "@/lib/local-time";
import { MAX_MED_TIMES_CHILD, MED_GAPS, doseWarning } from "@/lib/child-meds";
import { TEMP_MAX_TENTHS, TEMP_MIN_TENTHS } from "@/lib/child-temp";

/**
 * ยาและไข้ของลูก — ของครอบครัว viewer ดูได้อย่างเดียว
 *
 * ทุก query กรองด้วย family_id จาก session · childId / medId มาจาก client ต้องตรวจก่อนใช้
 */

const localTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง")
  .refine((v) => v <= localNowIso(Date.now() + 10 * 60_000), "เวลาต้องไม่เป็นอนาคต")
  .refine((v) => v >= "2000-01-01T00:00:00", "เวลาไม่ถูกต้อง");
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "รูปแบบเวลาไม่ถูกต้อง");
const id = z.string().min(1);

async function assertChild(db: Db, familyId: string, childId: string) {
  const row = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)))
    .get();
  if (!row) throw new AppError("ไม่พบข้อมูลลูกคนนี้");
  return row.id;
}

async function medOf(db: Db, familyId: string, medId: string) {
  const row = await db
    .select()
    .from(childMeds)
    .where(and(eq(childMeds.id, medId), eq(childMeds.familyId, familyId)))
    .get();
  if (!row) throw new AppError("ไม่พบยานี้");
  return row;
}

const revalidateChild = (childId: string) => {
  revalidatePath(`/baby/${childId}/meds`);
  revalidatePath(`/baby/${childId}/log`);
  revalidatePath(`/baby/${childId}/temp`);
};

export const saveChildMed = editorAction
  .metadata({ name: "saveChildMed" })
  .inputSchema(
    z
      .object({
        id: id.optional(),
        childId: id,
        name: z.string().trim().min(1, "ใส่ชื่อยา").max(80),
        dose: z.string().trim().max(40).nullable(),
        mode: z.enum(CHILD_MED_MODES),
        minGapMin: z
          .number()
          .int()
          .refine((v) => (MED_GAPS as readonly number[]).includes(v), "เลือกช่วงห่างจากตัวเลือก")
          .nullable(),
        times: z.array(hm).max(MAX_MED_TIMES_CHILD),
        note: z.string().trim().max(300).nullable(),
      })
      // ยาตามอาการต้องมีช่วงห่าง ไม่งั้นกันให้ซ้ำไม่ได้ · ยาประจำต้องมีอย่างน้อยหนึ่งเวลา
      .refine((v) => v.mode !== "prn" || v.minGapMin != null, {
        message: "เลือกช่วงห่างตามที่แพทย์หรือฉลากบอก",
        path: ["minGapMin"],
      })
      .refine((v) => v.mode !== "daily" || v.times.length > 0, {
        message: "ใส่เวลาที่ให้ยาอย่างน้อยหนึ่งเวลา",
        path: ["times"],
      }),
  )
  .action(async ({ parsedInput: p, ctx }) => {
    const childId = await assertChild(ctx.db, ctx.familyId, p.childId);
    const values = {
      name: p.name,
      dose: p.dose || null,
      mode: p.mode,
      minGapMin: p.mode === "prn" ? p.minGapMin : null,
      times: p.mode === "daily" ? [...new Set(p.times)].sort().join(",") : null,
      note: p.note || null,
    };
    if (p.id) {
      const res = await ctx.db
        .update(childMeds)
        .set(values)
        .where(and(eq(childMeds.id, p.id), eq(childMeds.familyId, ctx.familyId), eq(childMeds.childId, childId)))
        .returning({ id: childMeds.id });
      if (res.length === 0) throw new AppError("ไม่พบยานี้");
    } else {
      await ctx.db.insert(childMeds).values({
        id: crypto.randomUUID(),
        familyId: ctx.familyId,
        childId,
        createdBy: ctx.user.id,
        ...values,
      });
    }
    revalidateChild(childId);
    return { ok: true };
  });

/** หยุดให้ยา — ไม่ลบประวัติ คนถามย้อนหลังได้ว่าเคยให้อะไรไปบ้าง */
export const setChildMedActive = editorAction
  .metadata({ name: "setChildMedActive" })
  .inputSchema(z.object({ medId: id, active: z.boolean() }))
  .action(async ({ parsedInput: p, ctx }) => {
    const med = await medOf(ctx.db, ctx.familyId, p.medId);
    await ctx.db
      .update(childMeds)
      .set({ active: p.active })
      .where(and(eq(childMeds.id, med.id), eq(childMeds.familyId, ctx.familyId)));
    revalidateChild(med.childId);
    return { ok: true };
  });

export const deleteChildMed = editorAction
  .metadata({ name: "deleteChildMed" })
  .inputSchema(z.object({ medId: id }))
  .action(async ({ parsedInput: p, ctx }) => {
    const med = await medOf(ctx.db, ctx.familyId, p.medId);
    await ctx.db
      .delete(childMeds)
      .where(and(eq(childMeds.id, med.id), eq(childMeds.familyId, ctx.familyId)));
    revalidateChild(med.childId);
    return { ok: true };
  });

/**
 * บันทึกว่าให้ยาแล้ว
 *
 * ตรวจซ้ำที่เซิร์ฟเวอร์เสมอ ไม่เชื่อหน้าจอ: พ่อกับแม่กดพร้อมกันจากสองเครื่อง
 * หน้าจอของทั้งคู่ยังไม่เห็นของอีกคน — ที่นี่คือที่เดียวที่เห็นครบ
 * ถ้าเข้าข่ายให้ซ้ำและยังไม่ได้ยืนยัน คืนข้อเท็จจริงกลับไปให้ถาม (D3) ไม่บันทึก
 */
export const giveChildMed = editorAction
  .metadata({ name: "giveChildMed" })
  .inputSchema(z.object({ medId: id, at: localTime, confirm: z.boolean().default(false) }))
  .action(async ({ parsedInput: p, ctx }) => {
    const med = await medOf(ctx.db, ctx.familyId, p.medId);
    if (!p.confirm) {
      const recent = await ctx.db
        .select({
          id: childMedDoses.id,
          givenAt: childMedDoses.givenAt,
          givenBy: childMedDoses.givenBy,
          givenByName: user.name,
        })
        .from(childMedDoses)
        .leftJoin(user, eq(user.id, childMedDoses.givenBy))
        .where(and(eq(childMedDoses.medId, med.id), eq(childMedDoses.familyId, ctx.familyId)))
        .orderBy(desc(childMedDoses.givenAt))
        .limit(8);
      const warning = doseWarning(med, recent, p.at);
      if (warning) return { saved: false as const, warning };
    }
    const doseId = crypto.randomUUID();
    await ctx.db.insert(childMedDoses).values({
      id: doseId,
      familyId: ctx.familyId,
      medId: med.id,
      givenAt: p.at,
      givenBy: ctx.user.id,
    });
    revalidateChild(med.childId);
    return { saved: true as const, doseId };
  });

export const deleteChildMedDose = editorAction
  .metadata({ name: "deleteChildMedDose" })
  .inputSchema(z.object({ doseId: id }))
  .action(async ({ parsedInput: p, ctx }) => {
    const row = await ctx.db
      .select({ childId: childMeds.childId })
      .from(childMedDoses)
      .innerJoin(childMeds, eq(childMeds.id, childMedDoses.medId))
      .where(and(eq(childMedDoses.id, p.doseId), eq(childMedDoses.familyId, ctx.familyId)))
      .get();
    if (!row) throw new AppError("ไม่พบรายการนี้");
    await ctx.db
      .delete(childMedDoses)
      .where(and(eq(childMedDoses.id, p.doseId), eq(childMedDoses.familyId, ctx.familyId)));
    revalidateChild(row.childId);
    return { ok: true };
  });

export const addChildTemp = editorAction
  .metadata({ name: "addChildTemp" })
  .inputSchema(
    z.object({
      childId: id,
      at: localTime,
      tempTenths: z.number().int().min(TEMP_MIN_TENTHS, "ค่าต่ำเกินที่เครื่องวัดอ่านได้").max(TEMP_MAX_TENTHS, "ค่าสูงเกินที่เครื่องวัดอ่านได้"),
      site: z.enum(TEMP_SITES),
      symptoms: z.array(z.string().trim().min(1).max(40)).max(12),
      note: z.string().trim().max(300).nullable(),
    }),
  )
  .action(async ({ parsedInput: p, ctx }) => {
    const childId = await assertChild(ctx.db, ctx.familyId, p.childId);
    const symptoms = [...new Set(p.symptoms)];
    await ctx.db.insert(childTemps).values({
      id: crypto.randomUUID(),
      familyId: ctx.familyId,
      childId,
      measuredAt: p.at,
      tempTenths: p.tempTenths,
      site: p.site,
      symptoms: symptoms.length ? JSON.stringify(symptoms) : null,
      note: p.note || null,
      createdBy: ctx.user.id,
    });
    revalidateChild(childId);
    return { ok: true };
  });

export const deleteChildTemp = editorAction
  .metadata({ name: "deleteChildTemp" })
  .inputSchema(z.object({ tempId: id }))
  .action(async ({ parsedInput: p, ctx }) => {
    const row = await ctx.db
      .select({ childId: childTemps.childId })
      .from(childTemps)
      .where(and(eq(childTemps.id, p.tempId), eq(childTemps.familyId, ctx.familyId)))
      .get();
    if (!row) throw new AppError("ไม่พบรายการนี้");
    await ctx.db
      .delete(childTemps)
      .where(and(eq(childTemps.id, p.tempId), eq(childTemps.familyId, ctx.familyId)));
    revalidateChild(row.childId);
    return { ok: true };
  });
