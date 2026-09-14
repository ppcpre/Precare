"use server";

import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { appointments, photos } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import type { Db } from "@/db";
import { MAX_FILE_BYTES, StorageQuotaError, putObject } from "@/lib/storage";
import { readReceiptTotal, type ReceiptRead } from "@/lib/receipt";

const ALLOWED = ["image/webp", "image/jpeg", "image/png"];
/** นัดหนึ่งมีใบเสร็จหลายใบได้ (ค่าตรวจ + ค่ายา + ค่าแล็บ) แต่ไม่ถึงหลักสิบ */
const MAX_RECEIPTS_PER_APPT = 10;

/**
 * แนบใบเสร็จกับนัด แล้วลองอ่านยอดรวม
 *
 * **การแนบต้องสำเร็จแม้อ่านยอดไม่ได้** — ลำดับจึงเป็น เก็บไฟล์ -> บันทึกแถว
 * -> ค่อยเรียก AI ถ้า AI ล้มหรือโควตาฟรีหมด ใบเสร็จยังอยู่ ผู้ใช้กรอกเองได้
 *
 * ไม่ได้เขียนลง appointments.cost_satang เอง — ยอดที่อ่านได้เป็นแค่ข้อเสนอ
 * ผู้ใช้ต้องเห็นและกดบันทึกเองผ่าน saveCosts ซึ่งเป็นทางเขียนค่าใช้จ่ายทางเดียว
 */
export const attachReceipt = editorAction
  .metadata({ name: "attachReceipt" })
  .inputSchema(z.instanceof(FormData))
  .action(async ({ parsedInput: fd, ctx }) => {
    const appointmentId = String(fd.get("appointmentId") ?? "");
    const file = fd.get("file");
    if (!(file instanceof File)) throw new AppError("ยังไม่ได้เลือกรูปใบเสร็จ");
    if (!ALLOWED.includes(file.type)) throw new AppError("รองรับเฉพาะรูปภาพ (webp / jpeg / png)");
    if (file.size > MAX_FILE_BYTES) throw new AppError("รูปใบเสร็จใหญ่เกินกำหนด");

    const appt = await ctx.db
      .select({ apptDatetime: appointments.apptDatetime })
      .from(appointments)
      .where(and(eq(appointments.id, appointmentId), eq(appointments.familyId, ctx.familyId)))
      .get();
    if (!appt) throw new AppError("ไม่พบนัดหมายนี้");

    const count = await ctx.db
      .select({ n: sql<number>`count(*)` })
      .from(photos)
      .where(
        and(
          eq(photos.familyId, ctx.familyId),
          eq(photos.appointmentId, appointmentId),
          eq(photos.type, "receipt"),
        ),
      )
      .get();
    if (Number(count?.n ?? 0) >= MAX_RECEIPTS_PER_APPT) {
      throw new AppError(`แนบใบเสร็จได้ไม่เกิน ${MAX_RECEIPTS_PER_APPT} ใบต่อนัด`);
    }

    const { env } = await getCloudflareContext({ async: true });
    const body = await file.arrayBuffer();
    const id = crypto.randomUUID();
    const ext = file.type === "image/png" ? "png" : file.type === "image/jpeg" ? "jpg" : "webp";
    const key = `family/${ctx.familyId}/receipts/${id}.${ext}`;

    try {
      await putObject(ctx.db, env.PHOTOS_BUCKET, {
        bucketName: "photos",
        key,
        body,
        contentType: file.type,
        kind: "photo",
        familyId: ctx.familyId,
        uploadedBy: ctx.user.id,
      });
    } catch (e) {
      if (e instanceof StorageQuotaError) throw new AppError(e.message);
      throw e;
    }

    await ctx.db.insert(photos).values({
      id,
      familyId: ctx.familyId,
      appointmentId,
      // วันของใบเสร็จคือวันของนัด ไม่ใช่วันที่นึกได้แล้วมาถ่าย
      takenAt: appt.apptDatetime.slice(0, 10),
      type: "receipt",
      mediaKind: "photo",
      r2Key: key,
      uploadedBy: ctx.user.id,
    });

    const read = await readAndStore(ctx.db, env.AI, id, ctx.familyId, new Uint8Array(body), file.type);
    revalidatePath(`/appointments/${appointmentId}/edit`);
    return { id, read, suggestedSatang: await suggestedTotal(ctx.db, ctx.familyId, appointmentId) };
  });

/** อ่านใบเสร็จที่แนบไว้แล้วซ้ำ — ใช้ตอนรอบแรกอ่านไม่ได้ เช่นโควตาฟรีหมดไปแล้ว */
export const rereadReceipt = editorAction
  .metadata({ name: "rereadReceipt" })
  .inputSchema(z.object({ id: z.string().min(1) }))
  .action(async ({ parsedInput, ctx }) => {
    const row = await ctx.db
      .select({ r2Key: photos.r2Key, appointmentId: photos.appointmentId })
      .from(photos)
      .where(
        and(
          eq(photos.id, parsedInput.id),
          eq(photos.familyId, ctx.familyId),
          eq(photos.type, "receipt"),
        ),
      )
      .get();
    if (!row?.appointmentId) throw new AppError("ไม่พบใบเสร็จนี้");

    const { env } = await getCloudflareContext({ async: true });
    const obj = await env.PHOTOS_BUCKET.get(row.r2Key);
    if (!obj) throw new AppError("ไม่พบไฟล์ใบเสร็จ");
    const bytes = new Uint8Array(await obj.arrayBuffer());
    const mime = obj.httpMetadata?.contentType ?? "image/webp";

    const read = await readAndStore(ctx.db, env.AI, parsedInput.id, ctx.familyId, bytes, mime);
    revalidatePath(`/appointments/${row.appointmentId}/edit`);
    return {
      read,
      suggestedSatang: await suggestedTotal(ctx.db, ctx.familyId, row.appointmentId),
    };
  });

async function readAndStore(
  db: Db,
  ai: Ai | undefined,
  id: string,
  familyId: string,
  bytes: Uint8Array,
  mime: string,
): Promise<ReceiptRead> {
  const read = await readReceiptTotal(ai, bytes, mime);
  if (read.status === "read") {
    // กรอง familyId ซ้ำแม้ id จะผ่านการตรวจมาแล้ว — ฟังก์ชันนี้อาจถูกเรียกจากที่อื่นในอนาคต
    await db
      .update(photos)
      .set({ receiptTotalSatang: read.totalSatang })
      .where(and(eq(photos.id, id), eq(photos.familyId, familyId)));
  }
  return read;
}

/**
 * ยอดที่เสนอ = ผลรวมของทุกใบที่อ่านได้ในนัดนี้
 *
 * นัดเดียวมักมีหลายใบ (ค่าตรวจที่เคาน์เตอร์ + ค่ายาที่ห้องยา)
 * ใบที่อ่านไม่ได้ไม่ถูกนับเป็น 0 — มันไม่ถูกนับเลย และหน้าจอต้องบอกว่ามีใบที่ยังอ่านไม่ได้
 */
async function suggestedTotal(db: Db, familyId: string, appointmentId: string) {
  const row = await db
    .select({ sum: sql<number | null>`sum(${photos.receiptTotalSatang})` })
    .from(photos)
    .where(
      and(
        eq(photos.familyId, familyId),
        eq(photos.appointmentId, appointmentId),
        eq(photos.type, "receipt"),
      ),
    )
    .get();
  return row?.sum == null ? null : Number(row.sum);
}
