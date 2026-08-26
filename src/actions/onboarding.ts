"use server";

import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { families, familyMembers, pregnancyProfiles, user } from "@/db/schema";
import { authAction, AppError } from "@/lib/safe-action";
import { onboardingInput } from "@/lib/validation";
import { calculateDueDate, calculateLmpFromDueDate } from "@/lib/pregnancy";

const newId = () => crypto.randomUUID();
const toIso = (d: Date) => d.toISOString().slice(0, 10);

/**
 * T3.3 — สร้าง family + membership(owner) + pregnancy profile + ตั้ง activeFamilyId
 *
 * ⚠️ D1 ไม่รองรับ interactive transaction — ใช้ batch() ให้ทั้งชุดสำเร็จหรือล้มพร้อมกัน
 *    ถ้าแยกยิงทีละคำสั่งแล้วพังกลางทาง จะเหลือ family ที่ไม่มีเจ้าของค้างใน DB
 */
export const completeOnboarding = authAction
  .metadata({ name: "completeOnboarding" })
  .inputSchema(onboardingInput)
  .action(async ({ parsedInput, ctx }) => {
    if (ctx.user.activeFamilyId) throw new AppError("คุณมีครอบครัวอยู่แล้ว");

    const familyId = newId();
    let lmp = parsedInput.lmpDate ?? null;
    let due = parsedInput.dueDate ?? null;
    // กรอกอันไหนมา คำนวณอีกอันให้ — ตรงกับ toggle ในหน้า onboarding ขั้น 3
    if (lmp && !due) due = toIso(calculateDueDate(lmp));
    else if (due && !lmp) lmp = toIso(calculateLmpFromDueDate(due));

    await ctx.db.batch([
      ctx.db.insert(families).values({
        id: familyId,
        name: parsedInput.familyName,
        ownerId: ctx.user.id,
      }),
      ctx.db.insert(familyMembers).values({
        id: newId(),
        familyId,
        userId: ctx.user.id,
        role: "owner",
        status: "active",
      }),
      ctx.db.insert(pregnancyProfiles).values({ familyId, lmpDate: lmp, dueDate: due }),
      ctx.db.update(user).set({ activeFamilyId: familyId }).where(eq(user.id, ctx.user.id)),
    ]);

    redirect("/dashboard");
  });
