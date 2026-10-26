"use server";

import { and, eq, inArray } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Db } from "@/db";
import { MILESTONE_KINDS, childMeasurements, childMilestones, children, photos } from "@/db/schema";
import { AppError, editorAction } from "@/lib/safe-action";
import { isValidDay, localToday } from "@/lib/local-time";

const newId = () => crypto.randomUUID();

const NAME_MAX = 40;
const day = z.string().refine(isValidDay, "วันที่ไม่ถูกต้อง");

/**
 * วันเกิดในอนาคตเป็นไปไม่ได้ และปี 1900 ก็เป็นการพิมพ์ผิดแน่ๆ
 *
 * เช็คที่นี่ไม่ใช่แค่ที่ฟอร์ม เพราะ `<input type="date" max>` ผ่านได้ด้วย
 * การแก้ DOM และทุกช่องอายุในแอปคำนวณจากค่านี้ค่าเดียว
 */
const birthDate = day.refine(
  (v) => v <= localToday() && v >= "2000-01-01",
  "วันเกิดต้องไม่เป็นวันในอนาคต",
);

/**
 * ยืนยันว่าลูกคนนี้เป็นของครอบครัวที่ล็อกอินอยู่
 *
 * ⚠️ childId มาจาก URL หรือ form เสมอ เช็คแค่ `eq(children.id, …)` ไม่พอ
 *    ต้องคู่กับ familyId ทุกครั้ง ไม่งั้นแก้ข้อมูลลูกของครอบครัวอื่นได้
 */
/**
 * เซ็ตของลูกทั้งหมดในครอบครัวนี้ ใช้เป็นขอบเขตของ delete
 *
 * child_measurements กับ child_milestones ไม่มีคอลัมน์ family_id การ delete
 * ด้วย childId เฉยๆ จึง "ปลอดภัยเพราะมี assertChild อยู่ข้างบน" ซึ่งอ่านจาก
 * ตัว statement ไม่เห็น วันที่ใครลบบรรทัด assertChild ทิ้ง ช่องโหว่จะเปิดเงียบๆ
 * — เขียนให้ขอบเขตอยู่ใน where เอง แล้ว scripts/check-authz.mjs ตรวจได้จริง
 */
function childrenOfFamily(db: Db, familyId: string) {
  return db.select({ id: children.id }).from(children).where(eq(children.familyId, familyId));
}

async function assertChild(db: Db, familyId: string, childId: string) {
  const [row] = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)))
    .limit(1);
  if (!row) throw new AppError("ไม่พบข้อมูลลูกคนนี้");
  return row.id;
}

const revalidateChild = (id: string) => {
  revalidatePath("/baby");
  revalidatePath(`/baby/${id}`);
  revalidatePath("/album");
};

export const addChild = editorAction
  .metadata({ name: "addChild" })
  .inputSchema(
    z.object({
      name: z.string().trim().min(1, "ใส่ชื่อลูกก่อน").max(NAME_MAX),
      birthDate,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const id = newId();
    await ctx.db.insert(children).values({
      id,
      familyId: ctx.familyId,
      name: parsedInput.name,
      birthDate: parsedInput.birthDate,
      createdBy: ctx.user.id,
    });
    revalidateChild(id);
    return { id };
  });

/**
 * แก้ชื่อหรือวันเกิด
 *
 * วันเกิดแก้ได้โดยตั้งใจ — พิมพ์ผิดกันจริง พอแก้แล้วรูปทุกใบจะขยับช่องเองทันที
 * เพราะช่องอายุคำนวณสดจาก takenAt กับวันเกิด ไม่มีอะไรต้อง migrate
 */
export const updateChild = editorAction
  .metadata({ name: "updateChild" })
  .inputSchema(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1, "ใส่ชื่อลูกก่อน").max(NAME_MAX),
      birthDate,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await assertChild(ctx.db, ctx.familyId, parsedInput.id);
    await ctx.db
      .update(children)
      .set({ name: parsedInput.name, birthDate: parsedInput.birthDate })
      .where(and(eq(children.id, parsedInput.id), eq(children.familyId, ctx.familyId)));
    revalidateChild(parsedInput.id);
    return { ok: true };
  });

/**
 * ลบลูก
 *
 * รูปไม่ถูกลบตามไปด้วย (photos.child_id เป็น SET NULL) — ไฟล์ยังอยู่ในอัลบั้ม
 * คนที่กดลบอาจแค่กรอกผิดคน การลบรูปทิ้งไปด้วยเป็นสิ่งที่กู้คืนไม่ได้
 * และเราไม่ถามเหตุผลว่าทำไมถึงลบ
 */
export const deleteChild = editorAction
  .metadata({ name: "deleteChild" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await assertChild(ctx.db, ctx.familyId, parsedInput.id);
    await ctx.db
      .update(photos)
      .set({ childId: null })
      .where(and(eq(photos.childId, parsedInput.id), eq(photos.familyId, ctx.familyId)));
    await ctx.db
      .delete(children)
      .where(and(eq(children.id, parsedInput.id), eq(children.familyId, ctx.familyId)));
    revalidateChild(parsedInput.id);
    return { ok: true };
  });

/** ช่วงที่เป็นไปได้ของเด็ก 0–3 ขวบ — นอกช่วงนี้คือพิมพ์ผิด เช่น 35 แทน 3.5 */
const weightKg = z.number().min(0.4).max(40).nullable().optional();
const heightCm = z.number().min(20).max(130).nullable().optional();
const headCm = z.number().min(20).max(70).nullable().optional();

export const saveMeasurement = editorAction
  .metadata({ name: "saveMeasurement" })
  .inputSchema(
    z
      .object({ childId: z.string().min(1), measuredOn: day, weightKg, heightCm, headCm })
      .refine(
        (v) => v.weightKg != null || v.heightCm != null || v.headCm != null,
        "ใส่อย่างน้อยหนึ่งค่า",
      ),
  )
  .action(async ({ parsedInput, ctx }) => {
    await assertChild(ctx.db, ctx.familyId, parsedInput.childId);
    const id = newId();
    await ctx.db.insert(childMeasurements).values({
      id,
      childId: parsedInput.childId,
      measuredOn: parsedInput.measuredOn,
      weightKg: parsedInput.weightKg ?? null,
      heightCm: parsedInput.heightCm ?? null,
      headCm: parsedInput.headCm ?? null,
      createdBy: ctx.user.id,
    });
    revalidateChild(parsedInput.childId);
    return { id };
  });

export const deleteMeasurement = editorAction
  .metadata({ name: "deleteMeasurement" })
  .inputSchema(z.object({ id: z.string().min(1), childId: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    await assertChild(ctx.db, ctx.familyId, parsedInput.childId);
    await ctx.db
      .delete(childMeasurements)
      .where(
        and(
          eq(childMeasurements.id, parsedInput.id),
          eq(childMeasurements.childId, parsedInput.childId),
          inArray(childMeasurements.childId, childrenOfFamily(ctx.db, ctx.familyId)),
        ),
      );
    revalidateChild(parsedInput.childId);
    return { ok: true };
  });

/**
 * ปักหมุดพัฒนาการ — กดซ้ำคือการแก้วัน ไม่ใช่เพิ่มแถว
 *
 * ใช้ onConflictDoUpdate กับ unique index (child_id, kind) แทนการ select ก่อน
 * เพราะสองคนในครอบครัวกดพร้อมกันได้จริง และการเช็คก่อนเขียนจะแพ้ race
 */
export const setMilestone = editorAction
  .metadata({ name: "setMilestone" })
  .inputSchema(
    z.object({
      childId: z.string().min(1),
      kind: z.enum(MILESTONE_KINDS),
      achievedOn: day,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    await assertChild(ctx.db, ctx.familyId, parsedInput.childId);
    await ctx.db
      .insert(childMilestones)
      .values({
        id: newId(),
        childId: parsedInput.childId,
        kind: parsedInput.kind,
        achievedOn: parsedInput.achievedOn,
        createdBy: ctx.user.id,
      })
      .onConflictDoUpdate({
        target: [childMilestones.childId, childMilestones.kind],
        set: { achievedOn: parsedInput.achievedOn },
      });
    revalidateChild(parsedInput.childId);
    return { ok: true };
  });

export const clearMilestone = editorAction
  .metadata({ name: "clearMilestone" })
  .inputSchema(z.object({ childId: z.string().min(1), kind: z.enum(MILESTONE_KINDS) }))
  .action(async ({ parsedInput, ctx }) => {
    await assertChild(ctx.db, ctx.familyId, parsedInput.childId);
    await ctx.db
      .delete(childMilestones)
      .where(
        and(
          eq(childMilestones.childId, parsedInput.childId),
          eq(childMilestones.kind, parsedInput.kind),
          inArray(childMilestones.childId, childrenOfFamily(ctx.db, ctx.familyId)),
        ),
      );
    revalidateChild(parsedInput.childId);
    return { ok: true };
  });
