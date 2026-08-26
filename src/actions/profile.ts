"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { user } from "@/db/schema";
import { authAction, AppError } from "@/lib/safe-action";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { MAX_FILE_BYTES, StorageQuotaError, deleteObject, formatBytes, putObject } from "@/lib/storage";


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

const ALLOWED = ["image/webp", "image/jpeg", "image/png"];

/**
 * อัปโหลดรูปโปรไฟล์
 *
 * client resize เป็น webp ด้านยาว <= 512px ก่อนส่งมาแล้ว
 * ฝั่งนี้ยังตรวจซ้ำทั้งชนิดไฟล์และขนาด เพราะ client แก้ได้
 */
export const uploadAvatar = authAction
  .metadata({ name: "uploadAvatar" })
  .inputSchema(z.instanceof(FormData))
  .action(async ({ parsedInput, ctx }) => {
    const file = parsedInput.get("file");
    if (!(file instanceof File)) throw new AppError("ไม่พบไฟล์");
    if (!ALLOWED.includes(file.type)) throw new AppError("รองรับเฉพาะไฟล์ภาพ (webp / jpeg / png)");
    if (file.size > MAX_FILE_BYTES) {
      throw new AppError(`ไฟล์ใหญ่เกิน ${formatBytes(MAX_FILE_BYTES)}`);
    }

    const { env } = await getCloudflareContext({ async: true });
    // key คงที่ต่อผู้ใช้ — อัปโหลดใหม่ทับของเดิม ไม่สะสมไฟล์ขยะ
    const key = `avatars/${ctx.user.id}.webp`;

    try {
      await putObject(ctx.db, env.PHOTOS_BUCKET, {
        bucketName: "photos",
        key,
        body: await file.arrayBuffer(),
        contentType: file.type,
        kind: "avatar",
        familyId: ctx.user.activeFamilyId,
        uploadedBy: ctx.user.id,
      });
    } catch (e) {
      if (e instanceof StorageQuotaError) throw new AppError(e.message);
      throw e;
    }

    // ใส่ v= เพื่อ bust cache ของเบราว์เซอร์เมื่อเปลี่ยนรูป
    await ctx.db
      .update(user)
      .set({ image: `/api/media/${key}?v=${Date.now()}`, updatedAt: new Date() })
      .where(eq(user.id, ctx.user.id));

    revalidatePath("/profile");
    revalidatePath("/", "layout");
    return { ok: true };
  });

export const removeAvatar = authAction
  .metadata({ name: "removeAvatar" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const { env } = await getCloudflareContext({ async: true });
    await deleteObject(ctx.db, env.PHOTOS_BUCKET, `avatars/${ctx.user.id}.webp`);
    await ctx.db.update(user).set({ image: null, updatedAt: new Date() }).where(eq(user.id, ctx.user.id));
    revalidatePath("/profile");
    revalidatePath("/", "layout");
    return { ok: true };
  });
