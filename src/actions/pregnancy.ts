"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { pregnancyProfiles } from "@/db/schema";
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

    await ctx.db
      .update(pregnancyProfiles)
      .set({ lmpDate: lmp, dueDate: due, updatedAt: new Date().toISOString() })
      .where(eq(pregnancyProfiles.familyId, ctx.familyId));

    revalidatePath("/dashboard");
    revalidatePath("/profile/pregnancy");
    return { ok: true };
  });
