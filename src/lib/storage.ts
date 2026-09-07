import { and, eq, inArray, lt, notExists, or, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { photos, storageObjects } from "@/db/schema";

type StorageKind = "avatar" | "photo" | "video" | "asset";

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

/**
 * วิดีโอมีเพดานของตัวเอง และเพดานรวมยังเป็น 5 GB เท่าเดิม
 *
 * วิดีโอย่อไม่ได้ — Worker ไม่มี ffmpeg และการ transcode ในเบราว์เซอร์
 * ต้องใช้ ffmpeg.wasm ~30 MB ซึ่งเกินงบ bundle ทั้งโปรเจกต์ (3 MiB)
 * ตัวคุมปริมาณจึงเป็น "ความยาว + ขนาด" ต่อคลิป ไม่ใช่การบีบอัด
 *
 * ตัวเลขนี้มาจากของจริง: คลิป 1080p 30fps จากมือถืออยู่ราว 2 MB ต่อวินาที
 * 30 วินาทีจึงประมาณ 60 MB ซึ่งเกิน 40 — เจตนาให้เกินได้ เพื่อบังคับให้
 * คลิปที่ยาวเต็มเพดานต้องมาจากกล้องที่ตั้งคุณภาพต่ำลง ไม่ใช่ 4K
 *
 * ⚠️ 40 MB × 128 คลิป = 5 GB เต็มโควตารวม ตัวเลขนี้จึงไม่ใช่ค่ามั่ว
 *    ถ้าจะขยับ ต้องขยับพร้อมกับคิดว่าโควตารวมจะอยู่ได้กี่ครอบครัว
 */
export const MAX_VIDEO_BYTES = 40 * 1024 ** 2;
export const MAX_VIDEO_MS = 30_000;

/** เพดานต่อไฟล์ตามชนิด — วิดีโอใหญ่กว่าได้ แต่เพดานรวมยังเท่าเดิม */
export const maxBytesFor = (kind: StorageKind) =>
  kind === "video" ? MAX_VIDEO_BYTES : MAX_FILE_BYTES;

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
    kind: StorageKind;
    familyId?: string | null;
    uploadedBy?: string | null;
  },
) {
  const size = opts.body.byteLength;

  await assertRoomFor(db, size, opts.kind, opts.key);

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

/**
 * ตรวจว่าไฟล์ขนาดนี้เขียนได้ไหม — ทั้งเพดานต่อไฟล์และเพดานรวม
 *
 * แยกออกมาเพราะทางเดินของวิดีโอไม่ได้ถือ ArrayBuffer อยู่ในมือ
 * มันสตรีมเข้า R2 ตรงๆ จึงต้องถามคำถามนี้ก่อนเริ่มสตรีม ไม่ใช่หลัง
 */
export async function assertRoomFor(
  db: Db,
  size: number,
  kind: StorageKind,
  key?: string,
) {
  const cap = maxBytesFor(kind);
  if (size > cap) {
    throw new StorageQuotaError(
      `ไฟล์ใหญ่เกินไป (${formatBytes(size)}) — จำกัดที่ ${formatBytes(cap)} ต่อไฟล์`,
    );
  }

  const usage = await getStorageUsage(db);
  // เขียนทับไฟล์เดิม = คิดเฉพาะส่วนต่าง ไม่ใช่บวกใหม่ทั้งก้อน
  const existing = key
    ? await db
        .select({ sizeBytes: storageObjects.sizeBytes })
        .from(storageObjects)
        .where(eq(storageObjects.key, key))
        .get()
    : undefined;
  const delta = size - (existing?.sizeBytes ?? 0);

  if (usage.usedBytes + delta > STORAGE_LIMIT) {
    throw new StorageQuotaError(
      `พื้นที่เก็บไฟล์เต็ม (ใช้ไป ${formatBytes(usage.usedBytes)} จาก ${formatBytes(STORAGE_LIMIT)}) — ลบไฟล์เก่าออกก่อน`,
    );
  }
}

/** บันทึกไฟล์ที่เขียนลง R2 ไปแล้วเข้าบัญชี — ใช้กับทางเดินที่สตรีมเอง */
export async function recordObject(
  db: Db,
  opts: {
    bucketName: "assets" | "photos";
    key: string;
    sizeBytes: number;
    kind: StorageKind;
    familyId?: string | null;
    uploadedBy?: string | null;
  },
) {
  await db
    .insert(storageObjects)
    .values({
      id: crypto.randomUUID(),
      bucket: opts.bucketName,
      key: opts.key,
      sizeBytes: opts.sizeBytes,
      kind: opts.kind,
      familyId: opts.familyId ?? null,
      uploadedBy: opts.uploadedBy ?? null,
    })
    .onConflictDoUpdate({ target: storageObjects.key, set: { sizeBytes: opts.sizeBytes } });
}

/**
 * เก็บกวาดไฟล์ที่อยู่ใน R2 แต่ไม่มีแถวในอัลบั้มอ้างถึง
 *
 * ทางเดินของวิดีโอมีสองขา: สตรีมไฟล์ขึ้นก่อน แล้วค่อยบันทึกลงอัลบั้ม
 * ถ้าผู้ใช้ปิดหน้าคั่นกลาง ไฟล์จะค้างอยู่ใน R2 และยังกินโควตาของทุกคน
 * (โควตาเป็นก้อนเดียวทั้งแอป ไฟล์ค้างของครอบครัวหนึ่งจึงกินของครอบครัวอื่น)
 * หน้าปกก็ค้างได้ด้วยเหตุเดียวกัน ถ้าบันทึกแถวไม่สำเร็จหลังอัปหน้าปกไปแล้ว
 *
 * กวาดตอนอัปโหลดครั้งถัดไป ไม่ต้องมีงานเบื้องหลัง — คนที่ทำไฟล์ค้าง
 * คือคนที่จะกลับมาอัปโหลดอีก และเป็นจังหวะเดียวที่โควตามีความหมายกับเขา
 * เผื่อเวลาไว้ 1 ชั่วโมง เพราะการอัปโหลดที่ยังไม่จบก็ยังไม่มีแถวเหมือนกัน
 */
export async function sweepOrphanMedia(db: Db, bucket: R2Bucket, familyId: string) {
  const cutoff = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  // ไฟล์ของครอบครัวมีสองชนิดคือ photo กับ video และทั้งคู่ต้องมีแถวใน photos
  // อ้างถึงเสมอ — เป็น r2Key (ตัวไฟล์) หรือ thumbKey (หน้าปกของคลิป)
  // avatar กับ asset ไม่เกี่ยว จึงไม่แตะ
  const orphans = await db
    .select({ key: storageObjects.key })
    .from(storageObjects)
    .where(
      and(
        eq(storageObjects.familyId, familyId),
        inArray(storageObjects.kind, ["video", "photo"]),
        lt(storageObjects.createdAt, cutoff),
        notExists(
          db
            .select({ one: sql`1` })
            .from(photos)
            .where(
              or(
                eq(photos.r2Key, storageObjects.key),
                eq(photos.thumbKey, storageObjects.key),
              ),
            ),
        ),
      ),
    )
    .limit(20);

  for (const o of orphans) await deleteObject(db, bucket, o.key);
  return orphans.length;
}

/** ลบไฟล์ + ตัดยอดออกจากบัญชี */
export async function deleteObject(db: Db, bucket: R2Bucket, key: string) {
  await bucket.delete(key);
  await db.delete(storageObjects).where(eq(storageObjects.key, key));
}
