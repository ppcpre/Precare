"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { TRACKED_PROFILE_FIELDS, pregnancyProfileChanges, pregnancyProfiles } from "@/db/schema";
import { ownerAction } from "@/lib/safe-action";
import { pregnancyInput } from "@/lib/validation";
import { calculateDueDate, calculateLmpFromDueDate } from "@/lib/pregnancy";

const toIso = (d: Date) => d.toISOString().slice(0, 10);

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

    const asText = (v: string | number | null | undefined) =>
      v === null || v === undefined ? null : String(v);

    const changes = TRACKED_PROFILE_FIELDS.filter(
      (f) => asText(before?.[f]) !== asText(next[f]),
    ).map((f) => ({
      id: crypto.randomUUID(),
      familyId: ctx.familyId,
      field: f,
      oldValue: asText(before?.[f]),
      newValue: asText(next[f]),
      changedBy: ctx.user.id,
    }));

    await ctx.db
      .update(pregnancyProfiles)
      .set({ ...next, updatedAt: new Date().toISOString() })
      .where(eq(pregnancyProfiles.familyId, ctx.familyId));

    // เขียนหลังอัปเดตสำเร็จ — ไม่บันทึกการเปลี่ยนที่ไม่ได้เกิดขึ้นจริง
    if (changes.length) await ctx.db.insert(pregnancyProfileChanges).values(changes);

    revalidatePath("/dashboard");
    revalidatePath("/profile/pregnancy");
    return { ok: true };
  });
