"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MEAL_SLOTS, foodLogs } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import { estimateNutrition } from "@/lib/nutrition";
import { localNowIso } from "@/lib/local-time";

const newId = () => crypto.randomUUID();

/** ยาวกว่านี้ไม่ใช่ชื่อเมนูแล้ว และ prompt จะยาวเกินจำเป็น */
const NAME_MAX = 80;
const PORTION_MAX = 24;

const nutritionFields = {
  kcal: z.number().int().min(0).max(3000).nullable().optional(),
  carbG: z.number().int().min(0).max(500).nullable().optional(),
  sugarG: z.number().int().min(0).max(400).nullable().optional(),
  proteinG: z.number().int().min(0).max(300).nullable().optional(),
};

/**
 * ให้ AI ประมาณค่าโภชนาการจากชื่อเมนู — ยังไม่บันทึกอะไร
 *
 * แยกจากการบันทึกโดยตั้งใจ เพราะผู้ใช้ต้องได้เห็นและแก้ตัวเลขก่อนเสมอ
 * (บทเรียนจากการอ่านใบเสร็จ: โมเดลตอบผิดแบบมั่นใจ และผิดซ้ำเดิมทุกครั้ง)
 */
export const estimateFood = editorAction
  .metadata({ name: "estimateFood" })
  .inputSchema(
    z.object({
      name: z.string().trim().min(1, "ใส่ชื่อเมนูก่อน").max(NAME_MAX),
      portion: z.string().trim().max(PORTION_MAX).nullable().optional(),
    }),
  )
  .action(async ({ parsedInput }) => {
    const { env } = await getCloudflareContext({ async: true });
    const res = await estimateNutrition(env.AI, parsedInput.name, parsedInput.portion ?? null);
    // ไม่โยน error เมื่ออ่านไม่ได้ — กรอกเองได้ ไม่ใช่ทางตัน
    return res;
  });

export const addFoodLog = editorAction
  .metadata({ name: "addFoodLog" })
  .inputSchema(
    z.object({
      eatenOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "วันที่ไม่ถูกต้อง").optional(),
      slot: z.enum(MEAL_SLOTS),
      name: z.string().trim().min(1, "ใส่ชื่อเมนูก่อน").max(NAME_MAX),
      portion: z.string().trim().max(PORTION_MAX).nullable().optional(),
      source: z.enum(["ai", "user"]).default("user"),
      ...nutritionFields,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { eatenOn, portion, ...rest } = parsedInput;
    await ctx.db.insert(foodLogs).values({
      ...rest,
      id: newId(),
      familyId: ctx.familyId,
      // ไม่ส่งวันมา = วันนี้ตามเวลาไทย ไม่ใช่ UTC (ดู src/lib/local-time.ts)
      eatenOn: eatenOn ?? localNowIso().slice(0, 10),
      portion: portion || null,
      // กดบันทึกคือการยืนยัน ไม่ว่าตัวเลขจะมาจาก AI หรือพิมพ์เอง
      confirmed: true,
      createdBy: ctx.user.id,
    });
    revalidatePath("/food");
    revalidatePath("/health");
    return { ok: true };
  });

export const updateFoodLog = editorAction
  .metadata({ name: "updateFoodLog" })
  .inputSchema(
    z.object({
      id: z.string().min(1),
      name: z.string().trim().min(1).max(NAME_MAX).optional(),
      portion: z.string().trim().max(PORTION_MAX).nullable().optional(),
      slot: z.enum(MEAL_SLOTS).optional(),
      ...nutritionFields,
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const { id, ...rest } = parsedInput;
    const res = await ctx.db
      .update(foodLogs)
      .set({ ...rest, confirmed: true, source: "user" })
      .where(and(eq(foodLogs.id, id), eq(foodLogs.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบรายการนี้");
    revalidatePath("/food");
    revalidatePath("/health");
    return { ok: true };
  });

export const deleteFoodLog = editorAction
  .metadata({ name: "deleteFoodLog" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .delete(foodLogs)
      .where(and(eq(foodLogs.id, parsedInput.id), eq(foodLogs.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบรายการนี้");
    revalidatePath("/food");
    revalidatePath("/health");
    return { ok: true };
  });
