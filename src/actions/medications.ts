"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { MAX_MED_TIMES, medicationDoses, medicationTimes, medications } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import { isValidDay, localNowIso, localToday } from "@/lib/local-time";

const newId = () => crypto.randomUUID();

const NAME_MAX = 80;
const DOSE_MAX = 40;
const NOTE_MAX = 200;

/** HH:MM แบบ 24 ชั่วโมง — ตรงกับที่ `<input type="time">` ส่งมา */
const timeAt = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "เวลาไม่ถูกต้อง");

const day = z.string().refine(isValidDay, "วันที่ไม่ถูกต้อง");

const baseFields = {
  name: z.string().trim().min(1, "ใส่ชื่อยาหรือวิตามินก่อน").max(NAME_MAX),
  dose: z.string().trim().max(DOSE_MAX).nullable().optional(),
  note: z.string().trim().max(NOTE_MAX).nullable().optional(),
  startOn: day,
  /** ไม่ใส่ = กินต่อเนื่องไม่มีกำหนด ซึ่งเป็นกรณีของวิตามินบำรุงครรภ์ส่วนใหญ่ */
  endOn: day.nullable().optional(),
  /**
   * ตัดเวลาซ้ำทิ้งและเรียงให้ — เลือก 08:00 สองครั้งจะได้ push สองใบติดกัน
   * (บทเรียนเดียวกับเวลาเตือนของนัดหมาย)
   */
  times: z
    .array(timeAt)
    .min(1, "เลือกเวลาอย่างน้อยหนึ่งครั้ง")
    .max(MAX_MED_TIMES, `เลือกได้มากสุด ${MAX_MED_TIMES} ครั้งต่อวัน`)
    .transform((v) => [...new Set(v)].sort()),
};

const endsAfterStart = (v: { startOn: string; endOn?: string | null }) =>
  !v.endOn || v.endOn >= v.startOn;

export const addMedication = editorAction
  .metadata({ name: "addMedication" })
  .inputSchema(z.object(baseFields).refine(endsAfterStart, "วันสุดท้ายต้องไม่ก่อนวันเริ่ม"))
  .action(async ({ parsedInput, ctx }) => {
    const { times, dose, note, endOn, ...rest } = parsedInput;
    const id = newId();
    await ctx.db.batch([
      ctx.db.insert(medications).values({
        ...rest,
        id,
        familyId: ctx.familyId,
        // เจ้าของยาคือคนที่ล็อกอิน ไม่รับจาก input — ไม่งั้นใส่ยาให้คนอื่นได้
        userId: ctx.user.id,
        dose: dose || null,
        note: note || null,
        endOn: endOn || null,
        createdBy: ctx.user.id,
      }),
      ...times.map((at) =>
        ctx.db.insert(medicationTimes).values({ id: newId(), medicationId: id, at }),
      ),
    ]);
    revalidatePath("/medications");
    return { ok: true };
  });

export const updateMedication = editorAction
  .metadata({ name: "updateMedication" })
  .inputSchema(
    z
      .object({ id: z.string().min(1), active: z.boolean().optional(), ...baseFields })
      .refine(endsAfterStart, "วันสุดท้ายต้องไม่ก่อนวันเริ่ม"),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { id, times, dose, note, endOn, ...rest } = parsedInput;
    const res = await ctx.db
      .update(medications)
      .set({ ...rest, dose: dose || null, note: note || null, endOn: endOn || null })
      .where(
        and(
          eq(medications.id, id),
          eq(medications.familyId, ctx.familyId),
          // แก้ได้เฉพาะยาของตัวเอง — คนอื่นในครอบครัวดูได้อย่างเดียว
          eq(medications.userId, ctx.user.id),
        ),
      );
    if (!res.meta.changes) throw new AppError("แก้ได้เฉพาะยาของตัวเอง");

    /**
     * เวลาที่หายไปต้องลบ ที่เพิ่มมาต้องใส่ ส่วนที่เหมือนเดิมห้ามแตะ
     *
     * ลบทิ้งทั้งหมดแล้วใส่ใหม่จะง่ายกว่า แต่ dose ผูกกับ medication_time_id
     * ประวัติว่า "กินแล้ว" ของวันก่อนๆ จะถูก cascade ลบตามไปด้วยทั้งที่เวลาไม่ได้เปลี่ยน
     */
    const current = await ctx.db
      .select({ id: medicationTimes.id, at: medicationTimes.at })
      .from(medicationTimes)
      .where(eq(medicationTimes.medicationId, id));

    const keep = new Set(times);
    const gone = current.filter((c) => !keep.has(c.at)).map((c) => c.id);
    const have = new Set(current.map((c) => c.at));
    const added = times.filter((t) => !have.has(t));

    if (gone.length) {
      await ctx.db.delete(medicationTimes).where(inArray(medicationTimes.id, gone));
    }
    if (added.length) {
      await ctx.db
        .insert(medicationTimes)
        .values(added.map((at) => ({ id: newId(), medicationId: id, at })));
    }
    revalidatePath("/medications");
    return { ok: true };
  });

export const deleteMedication = editorAction
  .metadata({ name: "deleteMedication" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .delete(medications)
      .where(
        and(
          eq(medications.id, parsedInput.id),
          eq(medications.familyId, ctx.familyId),
          eq(medications.userId, ctx.user.id),
        ),
      );
    if (!res.meta.changes) throw new AppError("ลบได้เฉพาะยาของตัวเอง");
    revalidatePath("/medications");
    return { ok: true };
  });

/**
 * ติ๊กว่ากินแล้ว / ยกเลิกการติ๊ก
 *
 * แถว dose สร้างตอนติ๊กหรือตอนถูกเตือน ไม่ได้สร้างล่วงหน้าทั้งปี —
 * ยาที่ไม่มีวันจบจะกลายเป็นแถวไม่รู้จบถ้าสร้างล่วงหน้า
 */
export const setDoseTaken = editorAction
  .metadata({ name: "setDoseTaken" })
  .inputSchema(z.object({ timeId: z.string().min(1), dueOn: day, taken: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const { timeId, dueOn, taken } = parsedInput;
    if (dueOn > localToday()) throw new AppError("ติ๊กล่วงหน้าไม่ได้");

    /**
     * เวลานั้นต้องเป็นของยาของตัวเองจริง — ตาราง dose ไม่มี user_id ของตัวเอง
     * ถ้าไม่เช็คตรงนี้ ยิง action ตรงๆ แล้วติ๊กยาของคนอื่นได้
     */
    const owned = await ctx.db
      .select({ id: medicationTimes.id })
      .from(medicationTimes)
      .innerJoin(medications, eq(medications.id, medicationTimes.medicationId))
      .where(
        and(
          eq(medicationTimes.id, timeId),
          eq(medications.familyId, ctx.familyId),
          eq(medications.userId, ctx.user.id),
        ),
      )
      .get();
    if (!owned) throw new AppError("ติ๊กได้เฉพาะยาของตัวเอง");

    await ctx.db
      .insert(medicationDoses)
      .values({
        id: newId(),
        medicationTimeId: timeId,
        dueOn,
        takenAt: taken ? localNowIso() : null,
      })
      .onConflictDoUpdate({
        target: [medicationDoses.medicationTimeId, medicationDoses.dueOn],
        set: { takenAt: taken ? localNowIso() : null },
      });

    revalidatePath("/medications");
    return { ok: true };
  });
