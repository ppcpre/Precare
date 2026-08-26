"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { user } from "@/db/schema";
import { authAction } from "@/lib/safe-action";

export const updateProfile = authAction
  .metadata({ name: "updateProfile" })
  .inputSchema(z.object({ name: z.string().min(1, "กรุณากรอกชื่อ").max(80) }))
  .action(async ({ parsedInput, ctx }) => {
    // อีเมลแก้ไม่ได้ เพราะเป็น identifier ของบัญชี
    await ctx.db
      .update(user)
      .set({ name: parsedInput.name, updatedAt: new Date() })
      .where(eq(user.id, ctx.user.id));
    revalidatePath("/profile");
    return { ok: true };
  });
