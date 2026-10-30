"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { pregnancyProfileChanges, pregnancyProfiles } from "@/db/schema";
import type { TrackedProfileField } from "@/db/schema";
import { z } from "zod";
import { AppError, ownerAction } from "@/lib/safe-action";
import { pregnancyInput } from "@/lib/validation";
import { calculateDueDate, calculateLmpFromDueDate } from "@/lib/pregnancy";

const toIso = (d: Date) => d.toISOString().slice(0, 10);

type TrackedValue = string | number | null | undefined;
const asText = (v: TrackedValue) => (v === null || v === undefined ? null : String(v));

/**
 * แถวประวัติของเฉพาะฟิลด์ที่เปลี่ยนจริง
 *
 * วนตามคีย์ของ `next` ไม่ใช่ TRACKED_PROFILE_FIELDS ทั้งก้อน เพราะแต่ละ action
 * แก้คนละชุดฟิลด์ — การกดว่า "คลอดแล้ว" ไม่ได้แตะน้ำหนักหรือ LMP เลย
 * ถ้าวนทั้งก้อนจะเทียบกับ undefined แล้วบันทึกว่าค่าถูกลบทิ้ง ทั้งที่ไม่ได้แตะ
 */
function diffProfile(
  familyId: string,
  changedBy: string,
  before: Partial<Record<TrackedProfileField, TrackedValue>> | undefined,
  next: Partial<Record<TrackedProfileField, TrackedValue>>,
) {
  return (Object.keys(next) as TrackedProfileField[])
    .filter((f) => asText(before?.[f]) !== asText(next[f]))
    .map((f) => ({
      id: crypto.randomUUID(),
      familyId,
      field: f,
      oldValue: asText(before?.[f]),
      newValue: asText(next[f]),
      changedBy,
    }));
}

/** T3.4 — owner เท่านั้น ตาม permission matrix (editor แก้ไม่ได้) */
export const updatePregnancy = ownerAction
  .metadata({ name: "updatePregnancy" })
  .inputSchema(pregnancyInput)
  .action(async ({ parsedInput, ctx }) => {
    let { lmpDate: lmp, dueDate: due } = parsedInput;
    if (lmp && !due) due = toIso(calculateDueDate(lmp));
    else if (due && !lmp) lmp = toIso(calculateLmpFromDueDate(due));

    const next = {
      lmpDate: lmp,
      dueDate: due,
      heightCm: parsedInput.heightCm ?? null,
      prePregnancyWeight: parsedInput.prePregnancyWeight ?? null,
      hospitalName: parsedInput.hospitalName ?? null,
      hospitalPhone: parsedInput.hospitalPhone ?? null,
    };

    /**
     * อ่านค่าเดิมก่อนเขียน เพื่อบันทึกว่าอะไรเปลี่ยนจากอะไรเป็นอะไร
     *
     * ค่าพวกนี้เปลี่ยนความหมายของทั้งแอป — แก้น้ำหนักก่อนตั้งครรภ์ทีเดียว
     * ช่วงเกณฑ์ขยับทั้งกราฟ แก้ LMP ทีเดียวอายุครรภ์เปลี่ยนทั้งระบบ
     * ในแอปที่คนทั้งครอบครัวเห็นข้อมูลเดียวกัน ต้องตอบได้ว่าใครแก้ตอนไหน
     */
    const before = await ctx.db
      .select({
        lmpDate: pregnancyProfiles.lmpDate,
        dueDate: pregnancyProfiles.dueDate,
        heightCm: pregnancyProfiles.heightCm,
        prePregnancyWeight: pregnancyProfiles.prePregnancyWeight,
      })
      .from(pregnancyProfiles)
      .where(eq(pregnancyProfiles.familyId, ctx.familyId))
      .get();

    const changes = diffProfile(ctx.familyId, ctx.user.id, before, next);

    await ctx.db
      .update(pregnancyProfiles)
      .set({ ...next, updatedAt: new Date().toISOString() })
      .where(eq(pregnancyProfiles.familyId, ctx.familyId));

    // เขียนหลังอัปเดตสำเร็จ — ไม่บันทึกการเปลี่ยนที่ไม่ได้เกิดขึ้นจริง
    if (changes.length) await ctx.db.insert(pregnancyProfileChanges).values(changes);

    revalidatePath("/dashboard");
    revalidatePath("/profile/pregnancy");
    revalidatePath("/danger/pregnancy");
    return { ok: true };
  });

/**
 * บันทึกว่าคลอดแล้ว — หรือกดกลับถ้ากดผิด
 *
 * ทำไมต้องมีสวิตช์นี้: การ์ดบนหน้าแรกคำนวณจากอายุครรภ์ (อายุครรภ์ นับลูกดิ้น
 * จับเวลาการบีบตัว) และกราฟน้ำหนักเทียบเกณฑ์ IOM ในหน้าสุขภาพก็ด้วย
 * ถ้าไม่มีอะไรบอกว่าจบแล้ว มันจะนับ "สัปดาห์ที่ 43, 44, 45…" ต่อไปเรื่อยๆ
 * และยังชวนนับลูกดิ้นอยู่
 *
 * ⚠️ ข้อความทุกคำรอบการกดนี้ต้องเป็นกลาง — ไม่แสดงความยินดี ไม่ถือว่ามีลูกแล้ว
 *    ไม่ถามว่าทำไม การตั้งครรภ์ไม่ได้จบด้วยลูกเสมอไป และคนที่เพิ่งสูญเสีย
 *    ก็ต้องใช้ปุ่มนี้เพื่อให้แอปหยุดนับ
 *
 * กดกลับได้ เพราะกดผิดเกิดขึ้นได้และไม่มีเหตุผลจะล็อก — ข้อมูลเดิมไม่ถูกลบ
 * แค่หยุดคำนวณ
 */
export const setPregnancyStatus = ownerAction
  .metadata({ name: "setPregnancyStatus" })
  .inputSchema(z.object({ status: z.enum(["pregnant", "postpartum"]) }))
  .action(async ({ parsedInput, ctx }) => {
    const before = await ctx.db
      .select({ status: pregnancyProfiles.status })
      .from(pregnancyProfiles)
      .where(eq(pregnancyProfiles.familyId, ctx.familyId))
      .get();
    if (!before) throw new AppError("ยังไม่ได้ตั้งค่าข้อมูลการตั้งครรภ์");

    const changes = diffProfile(ctx.familyId, ctx.user.id, before, {
      status: parsedInput.status,
    });

    await ctx.db
      .update(pregnancyProfiles)
      .set({ status: parsedInput.status, updatedAt: new Date().toISOString() })
      .where(eq(pregnancyProfiles.familyId, ctx.familyId));

    if (changes.length) await ctx.db.insert(pregnancyProfileChanges).values(changes);

    revalidatePath("/dashboard");
    revalidatePath("/health");
    revalidatePath("/profile/pregnancy");
    return { status: parsedInput.status };
  });
