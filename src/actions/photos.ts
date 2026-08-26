"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { photos, pregnancyProfiles, PHOTO_TYPES } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import { MAX_FILE_BYTES, StorageQuotaError, deleteObject, putObject } from "@/lib/storage";
import { calculateGestationalAge } from "@/lib/pregnancy";

const ALLOWED = ["image/webp", "image/jpeg", "image/png"];
const MAX_PER_BATCH = 10;

/**
 * เพิ่มรูปเข้าอัลบั้ม — รับได้หลายรูปต่อครั้ง
 *
 * client ย่อรูปเป็น webp ให้แล้ว แต่ฝั่งนี้ยังตรวจซ้ำทั้งชนิดและขนาด
 * เพราะ client แก้ได้ และโควตาเป็นเรื่องที่พลาดไม่ได้
 */
export const addPhotos = editorAction
  .metadata({ name: "addPhotos" })
  .inputSchema(z.instanceof(FormData))
  .action(async ({ parsedInput: fd, ctx }) => {
    const files = fd.getAll("files").filter((f): f is File => f instanceof File);
    if (files.length === 0) throw new AppError("ยังไม่ได้เลือกรูป");
    if (files.length > MAX_PER_BATCH) throw new AppError(`เพิ่มได้ครั้งละไม่เกิน ${MAX_PER_BATCH} รูป`);

    const takenAt = String(fd.get("takenAt") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(takenAt)) throw new AppError("วันที่ถ่ายไม่ถูกต้อง");

    const type = String(fd.get("type") ?? "other");
    if (!PHOTO_TYPES.includes(type as (typeof PHOTO_TYPES)[number])) {
      throw new AppError("ประเภทรูปไม่ถูกต้อง");
    }
    const caption = String(fd.get("caption") ?? "").trim().slice(0, 500) || null;
    const pinned = fd.get("pinned") === "true";
    const logId = (fd.get("logId") as string) || null;

    // สัปดาห์คำนวณจาก "วันที่ถ่าย" ไม่ใช่วันนี้ — รูปเก่าจึงไปอยู่สัปดาห์ที่ถูกต้อง
    const profile = await ctx.db
      .select({ lmpDate: pregnancyProfiles.lmpDate })
      .from(pregnancyProfiles)
      .where(eq(pregnancyProfiles.familyId, ctx.familyId))
      .get();
    const week = profile?.lmpDate
      ? calculateGestationalAge(profile.lmpDate, new Date(takenAt)).weeks
      : null;

    const { env } = await getCloudflareContext({ async: true });
    const created: string[] = [];

    for (const [i, file] of files.entries()) {
      if (!ALLOWED.includes(file.type)) throw new AppError("รองรับเฉพาะไฟล์ภาพ (webp / jpeg / png)");
      if (file.size > MAX_FILE_BYTES) throw new AppError(`มีไฟล์ที่ใหญ่เกินกำหนด`);

      const id = crypto.randomUUID();
      const key = `family/${ctx.familyId}/photos/${id}.webp`;
      try {
        await putObject(ctx.db, env.PHOTOS_BUCKET, {
          bucketName: "photos",
          key,
          body: await file.arrayBuffer(),
          contentType: file.type,
          kind: "photo",
          familyId: ctx.familyId,
          uploadedBy: ctx.user.id,
        });
      } catch (e) {
        if (e instanceof StorageQuotaError) {
          // บอกให้ชัดว่าอัปโหลดสำเร็จไปกี่รูปก่อนเต็ม จะได้ไม่ต้องเดา
          throw new AppError(
            created.length
              ? `${e.message} (เพิ่มสำเร็จ ${created.length} รูปก่อนหน้า)`
              : e.message,
          );
        }
        throw e;
      }

      await ctx.db.insert(photos).values({
        id,
        familyId: ctx.familyId,
        logId,
        week,
        takenAt,
        // ปักหมุดเฉพาะรูปแรกของชุด ไม่งั้นทั้งชุดจะเป็นรูปเด่นหมด
        pinned: pinned && i === 0,
        type: type as (typeof PHOTO_TYPES)[number],
        r2Key: key,
        caption,
        uploadedBy: ctx.user.id,
      });
      created.push(id);
    }

    revalidatePath("/album");
    revalidatePath("/health");
    return { count: created.length };
  });

export const deletePhoto = editorAction
  .metadata({ name: "deletePhoto" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const row = await ctx.db
      .select({ r2Key: photos.r2Key })
      .from(photos)
      .where(and(eq(photos.id, parsedInput.id), eq(photos.familyId, ctx.familyId)))
      .get();
    if (!row) throw new AppError("ไม่พบรูปนี้");

    const { env } = await getCloudflareContext({ async: true });
    // ลบไฟล์ก่อน แล้วค่อยลบแถว — ถ้าสลับกันแล้วพังกลางทางจะเหลือไฟล์กำพร้ากินโควตา
    await deleteObject(ctx.db, env.PHOTOS_BUCKET, row.r2Key);
    await ctx.db
      .delete(photos)
      .where(and(eq(photos.id, parsedInput.id), eq(photos.familyId, ctx.familyId)));

    revalidatePath("/album");
    return { ok: true };
  });

export const togglePin = editorAction
  .metadata({ name: "togglePin" })
  .inputSchema(z.object({ id: z.string().min(1), pinned: z.boolean() }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .update(photos)
      .set({ pinned: parsedInput.pinned })
      .where(and(eq(photos.id, parsedInput.id), eq(photos.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบรูปนี้");
    revalidatePath("/album");
    return { ok: true };
  });
