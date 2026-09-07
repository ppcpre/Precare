"use server";

import { and, eq } from "drizzle-orm";
import type { Db } from "@/db";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { appointments, photos, pregnancyProfiles, storageObjects, PHOTO_TYPES } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import {
  MAX_FILE_BYTES,
  MAX_VIDEO_MS,
  StorageQuotaError,
  deleteObject,
  putObject,
  sweepOrphanMedia,
} from "@/lib/storage";
import { calculateGestationalAge } from "@/lib/pregnancy";

const ALLOWED = ["image/webp", "image/jpeg", "image/png"];
const MAX_PER_BATCH = 10;

/** สัปดาห์คำนวณจาก "วันที่ถ่าย" ไม่ใช่วันนี้ — ของเก่าจึงไปอยู่สัปดาห์ที่ถูกต้อง */
async function weekOfTakenAt(db: Db, familyId: string, takenAt: string) {
  const profile = await db
    .select({ lmpDate: pregnancyProfiles.lmpDate })
    .from(pregnancyProfiles)
    .where(eq(pregnancyProfiles.familyId, familyId))
    .get();
  return profile?.lmpDate
    ? calculateGestationalAge(profile.lmpDate, new Date(takenAt)).weeks
    : null;
}

/**
 * นัดหมายที่อ้างถึงต้องเป็นของครอบครัวนี้จริง
 *
 * client ส่ง id อะไรมาก็ได้ ถ้าไม่ตรวจ ไฟล์ของเราจะไปโผล่ใต้นัดของครอบครัวอื่น
 * (อ่านไม่ได้เพราะ listAppointmentMedia กรอง familyId อยู่แล้ว แต่ข้อมูลจะเพี้ยน)
 */
async function assertAppointment(db: Db, familyId: string, id: string | null) {
  if (!id) return null;
  const row = await db
    .select({ id: appointments.id })
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.familyId, familyId)))
    .get();
  if (!row) throw new AppError("ไม่พบนัดหมายนี้");
  return id;
}

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
    const appointmentId = await assertAppointment(
      ctx.db,
      ctx.familyId,
      (fd.get("appointmentId") as string) || null,
    );

    const week = await weekOfTakenAt(ctx.db, ctx.familyId, takenAt);

    const { env } = await getCloudflareContext({ async: true });
    await sweepOrphanMedia(ctx.db, env.PHOTOS_BUCKET, ctx.familyId);
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
        appointmentId,
        uploadedBy: ctx.user.id,
      });
      created.push(id);
    }

    revalidatePath("/album");
    revalidatePath("/health");
    revalidatePath("/appointments");
    return { count: created.length };
  });

/**
 * บันทึกวิดีโอที่สตรีมขึ้น R2 ไปแล้วเข้าอัลบั้ม — ขาที่สองของ /api/media/video
 *
 * ไฟล์ขึ้นไปก่อนแล้ว ตรงนี้ทำสองอย่าง: ตรวจว่า key นั้นเป็นของครอบครัวนี้จริง
 * และแนบหน้าปกที่เบราว์เซอร์ดึงเฟรมมาให้ (server สร้างเองไม่ได้)
 *
 * ที่ต้องแยกสองขาเพราะ metadata เป็นข้อมูลสุขภาพ ส่งไปกับไฟล์ใน query string
 * ไม่ได้ (จะไปโผล่ใน access log) และ Server Action ก็รับไฟล์ 40 MB ไม่ไหว
 */
export const addVideo = editorAction
  .metadata({ name: "addVideo" })
  .inputSchema(z.instanceof(FormData))
  .action(async ({ parsedInput: fd, ctx }) => {
    const key = String(fd.get("key") ?? "");
    const takenAt = String(fd.get("takenAt") ?? "");
    if (!/^\d{4}-\d{2}-\d{2}$/.test(takenAt)) throw new AppError("วันที่ถ่ายไม่ถูกต้อง");

    const type = String(fd.get("type") ?? "other");
    if (!PHOTO_TYPES.includes(type as (typeof PHOTO_TYPES)[number])) {
      throw new AppError("ประเภทไฟล์ไม่ถูกต้อง");
    }
    const durationMs = Number(fd.get("durationMs") ?? 0);
    const caption = String(fd.get("caption") ?? "").trim().slice(0, 500) || null;
    const logId = (fd.get("logId") as string) || null;
    const appointmentId = await assertAppointment(
      ctx.db,
      ctx.familyId,
      (fd.get("appointmentId") as string) || null,
    );

    const { env } = await getCloudflareContext({ async: true });

    // key ต้องเป็นของครอบครัวนี้และยังไม่ถูกผูกกับแถวไหน
    // ไม่ตรวจ = ส่ง key ของครอบครัวอื่นมาแล้วดึงคลิปเขาเข้าอัลบั้มเราได้
    const obj = await ctx.db
      .select({ key: storageObjects.key })
      .from(storageObjects)
      .where(
        and(
          eq(storageObjects.key, key),
          eq(storageObjects.familyId, ctx.familyId),
          eq(storageObjects.kind, "video"),
        ),
      )
      .get();
    if (!obj) throw new AppError("ไม่พบไฟล์ที่อัปโหลดไว้ ลองอัปโหลดใหม่อีกครั้ง");

    const already = await ctx.db
      .select({ id: photos.id })
      .from(photos)
      .where(and(eq(photos.r2Key, key), eq(photos.familyId, ctx.familyId)))
      .get();
    if (already) throw new AppError("คลิปนี้ถูกบันทึกไปแล้ว");

    // เพดานความยาวต้องบังคับฝั่งนี้ด้วย ฝั่ง client แก้ได้
    // ถ้าไม่ผ่าน ลบไฟล์ทิ้งเลย ไม่ปล่อยให้ค้างกินโควตาของทุกครอบครัว
    if (!durationMs || durationMs > MAX_VIDEO_MS) {
      await deleteObject(ctx.db, env.PHOTOS_BUCKET, key);
      throw new AppError(`คลิปยาวเกิน ${MAX_VIDEO_MS / 1000} วินาที`);
    }

    // หน้าปกไม่มีไม่ได้ ไม่งั้นกริดอัลบั้มเป็นกล่องดำล้วนแยกคลิปไม่ออก
    const poster = fd.get("poster");
    if (!(poster instanceof File) || poster.type !== "image/webp") {
      await deleteObject(ctx.db, env.PHOTOS_BUCKET, key);
      throw new AppError("สร้างหน้าปกคลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
    }

    const id = crypto.randomUUID();
    const thumbKey = `family/${ctx.familyId}/posters/${id}.webp`;
    try {
      await putObject(ctx.db, env.PHOTOS_BUCKET, {
        bucketName: "photos",
        key: thumbKey,
        body: await poster.arrayBuffer(),
        contentType: "image/webp",
        kind: "photo",
        familyId: ctx.familyId,
        uploadedBy: ctx.user.id,
      });
    } catch (e) {
      await deleteObject(ctx.db, env.PHOTOS_BUCKET, key);
      if (e instanceof StorageQuotaError) throw new AppError(e.message);
      throw e;
    }

    await ctx.db.insert(photos).values({
      id,
      familyId: ctx.familyId,
      logId,
      week: await weekOfTakenAt(ctx.db, ctx.familyId, takenAt),
      takenAt,
      type: type as (typeof PHOTO_TYPES)[number],
      mediaKind: "video",
      durationMs,
      r2Key: key,
      thumbKey,
      caption,
      appointmentId,
      uploadedBy: ctx.user.id,
    });

    revalidatePath("/album");
    revalidatePath("/appointments");
    return { id };
  });

export const deletePhoto = editorAction
  .metadata({ name: "deletePhoto" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const row = await ctx.db
      .select({ r2Key: photos.r2Key, thumbKey: photos.thumbKey })
      .from(photos)
      .where(and(eq(photos.id, parsedInput.id), eq(photos.familyId, ctx.familyId)))
      .get();
    if (!row) throw new AppError("ไม่พบรูปนี้");

    const { env } = await getCloudflareContext({ async: true });
    // ลบไฟล์ก่อน แล้วค่อยลบแถว — ถ้าสลับกันแล้วพังกลางทางจะเหลือไฟล์กำพร้ากินโควตา
    await deleteObject(ctx.db, env.PHOTOS_BUCKET, row.r2Key);
    // วิดีโอมีหน้าปกเป็นอีกไฟล์ ลืมลบแล้วมันจะค้างอยู่ตลอดไปโดยไม่มีอะไรอ้างถึง
    if (row.thumbKey) await deleteObject(ctx.db, env.PHOTOS_BUCKET, row.thumbKey);
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
