import { eq, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { storageObjects } from "@/db/schema";

/**
 * โควตาพื้นที่เก็บไฟล์ — ตั้งเพดานเองต่ำกว่าที่ Cloudflare ให้ เพื่อกันบิลบานปลาย
 *
 * R2 free tier ให้ 10 GB แต่เราหยุดที่ 5 GB เพื่อเหลือระยะปลอดภัย
 * ถ้าเกิน 10 GB จะเริ่มมีค่าใช้จ่าย ซึ่งขัดกับที่ตกลงกันว่าจะอยู่ฟรี
 */
export const STORAGE_LIMIT = 5 * 1024 ** 3; // 5 GB — เกินแล้วอัปโหลดไม่ได้
export const STORAGE_WARN = 4 * 1024 ** 3; // 4 GB — เริ่มขึ้นป้ายเตือน
/** ไฟล์เดี่ยวห้ามเกิน 5 MB — รูปที่ resize ฝั่ง client แล้วไม่ควรใหญ่กว่านี้ */
export const MAX_FILE_BYTES = 5 * 1024 ** 2;

export class StorageQuotaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StorageQuotaError";
  }
}

export type StorageUsage = {
  usedBytes: number;
  limitBytes: number;
  percent: number;
  /** ถึงเกณฑ์เตือนแล้วหรือยัง (4 GB) */
  warn: boolean;
  /** เต็มแล้ว อัปโหลดต่อไม่ได้ (5 GB) */
  full: boolean;
};

export async function getStorageUsage(db: Db): Promise<StorageUsage> {
  const row = await db
    .select({ total: sql<number>`coalesce(sum(${storageObjects.sizeBytes}), 0)` })
    .from(storageObjects)
    .get();
  const usedBytes = Number(row?.total ?? 0);
  return {
    usedBytes,
    limitBytes: STORAGE_LIMIT,
    percent: Math.min(100, (usedBytes / STORAGE_LIMIT) * 100),
    warn: usedBytes >= STORAGE_WARN,
    full: usedBytes >= STORAGE_LIMIT,
  };
}

export const formatBytes = (n: number) => {
  if (n >= 1024 ** 3) return `${(n / 1024 ** 3).toFixed(2)} GB`;
  if (n >= 1024 ** 2) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  if (n >= 1024) return `${Math.round(n / 1024)} KB`;
  return `${n} B`;
};

/**
 * บันทึกไฟล์ลง R2 พร้อมกันโควตา — **ต้องเรียกผ่านฟังก์ชันนี้เท่านั้น**
 * ห้ามเรียก bucket.put() ตรง ไม่งั้นยอดใน D1 จะไม่ตรงกับของจริง
 */
export async function putObject(
  db: Db,
  bucket: R2Bucket,
  opts: {
    bucketName: "assets" | "photos";
    key: string;
    body: ArrayBuffer;
    contentType: string;
    kind: "avatar" | "photo" | "asset";
    familyId?: string | null;
    uploadedBy?: string | null;
  },
) {
  const size = opts.body.byteLength;

  if (size > MAX_FILE_BYTES) {
    throw new StorageQuotaError(
      `ไฟล์ใหญ่เกินไป (${formatBytes(size)}) — จำกัดที่ ${formatBytes(MAX_FILE_BYTES)} ต่อไฟล์`,
    );
  }

  // เช็คก่อนเขียน — ถ้าเต็มแล้วไม่ต้องเสียเวลาอัปโหลด
  const usage = await getStorageUsage(db);
  const existing = await db
    .select({ sizeBytes: storageObjects.sizeBytes })
    .from(storageObjects)
    .where(eq(storageObjects.key, opts.key))
    .get();
  // เขียนทับไฟล์เดิม = คิดเฉพาะส่วนต่าง ไม่ใช่บวกใหม่ทั้งก้อน
  const delta = size - (existing?.sizeBytes ?? 0);

  if (usage.usedBytes + delta > STORAGE_LIMIT) {
    throw new StorageQuotaError(
      `พื้นที่เก็บไฟล์เต็ม (ใช้ไป ${formatBytes(usage.usedBytes)} จาก ${formatBytes(STORAGE_LIMIT)}) — ลบไฟล์เก่าออกก่อน`,
    );
  }

  await bucket.put(opts.key, opts.body, { httpMetadata: { contentType: opts.contentType } });

  // upsert บัญชีไฟล์ให้ตรงกับของจริงเสมอ
  await db
    .insert(storageObjects)
    .values({
      id: crypto.randomUUID(),
      bucket: opts.bucketName,
      key: opts.key,
      sizeBytes: size,
      kind: opts.kind,
      familyId: opts.familyId ?? null,
      uploadedBy: opts.uploadedBy ?? null,
    })
    .onConflictDoUpdate({ target: storageObjects.key, set: { sizeBytes: size } });

  return { key: opts.key, size };
}

/** ลบไฟล์ + ตัดยอดออกจากบัญชี */
export async function deleteObject(db: Db, bucket: R2Bucket, key: string) {
  await bucket.delete(key);
  await db.delete(storageObjects).where(eq(storageObjects.key, key));
}
