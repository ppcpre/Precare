import { and, eq, inArray, isNull, lt, notExists, or, sql } from "drizzle-orm";
import { MAX_VIDEO_BYTES } from "@/lib/media-limits";
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

/**
 * เพดานต่อครอบครัว — กันครอบครัวเดียวกินพื้นที่ของทุกคนจนหมด
 *
 * ไม่มีเพดานนี้ = ครอบครัวเดียวอัปคลิป 500 MB สิบไฟล์ก็เต็ม 5 GB ของทั้งระบบ
 * แล้วทุกครอบครัวอัปอะไรไม่ได้อีกเลย โดยที่คนที่โดนไม่รู้ด้วยซ้ำว่าเพราะอะไร
 *
 * 1 GB ต่อครอบครัว = รองรับได้ 5 ครอบครัวเต็มเพดานพอดีในเพดานรวม 5 GB
 * และยังอัปคลิป 500 MB ได้สองคลิปซึ่งเกินพอสำหรับคลิปอัลตราซาวด์
 */
export const FAMILY_LIMIT = 1024 ** 3; // 1 GB ต่อครอบครัว
export const FAMILY_WARN = 800 * 1024 ** 2; // 800 MB — เริ่มขึ้นป้ายเตือน
/** ไฟล์เดี่ยวห้ามเกิน 5 MB — รูปที่ resize ฝั่ง client แล้วไม่ควรใหญ่กว่านี้ */
export const MAX_FILE_BYTES = 5 * 1024 ** 2;

/**
 * เพดานของวิดีโออยู่ใน media-limits.ts เพราะฝั่ง client ต้องใช้ตัวเลขเดียวกัน
 * และ import ไฟล์นี้ไม่ได้ (มี drizzle กับ schema ติดมาด้วย)
 */
export { MAX_VIDEO_BYTES, MAX_VIDEO_MS, VIDEO_PART_BYTES } from "@/lib/media-limits";

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
  /** ถึงเกณฑ์เตือนแล้วหรือยัง */
  warn: boolean;
  /** เต็มแล้ว อัปโหลดต่อไม่ได้ */
  full: boolean;
  /** นับของครอบครัวเดียว หรือของทั้งระบบ — ใช้เลือกคำที่แสดงในหน้าจอ */
  scope: "family" | "system";
};

/**
 * พื้นที่ที่ใช้ไป — ของครอบครัวหนึ่ง หรือของทั้งระบบถ้าไม่ระบุ
 *
 * หน้าจอทุกหน้าควรส่ง familyId เสมอ เพราะเลขที่ผู้ใช้ต้องตัดสินใจคือ
 * "ครอบครัวฉันเหลือเท่าไหร่" ไม่ใช่ยอดรวมของคนอื่นที่เขาทำอะไรไม่ได้
 *
 * ไฟล์ของผู้ใช้เอง (avatar) มี family_id เป็น null จึงไม่ถูกนับเข้าครอบครัวไหน
 * แต่ยังนับรวมในเพดานของระบบ — ตั้งใจ เพราะ avatar ติดตัวผู้ใช้ข้ามครอบครัว
 */
export async function getStorageUsage(db: Db, familyId?: string): Promise<StorageUsage> {
  const q = db
    .select({ total: sql<number>`coalesce(sum(${storageObjects.sizeBytes}), 0)` })
    .from(storageObjects);
  const row = await (familyId
    ? q.where(eq(storageObjects.familyId, familyId)).get()
    : q.get());

  const usedBytes = Number(row?.total ?? 0);
  const limitBytes = familyId ? FAMILY_LIMIT : STORAGE_LIMIT;
  const warnAt = familyId ? FAMILY_WARN : STORAGE_WARN;
  return {
    usedBytes,
    limitBytes,
    percent: Math.min(100, (usedBytes / limitBytes) * 100),
    warn: usedBytes >= warnAt,
    full: usedBytes >= limitBytes,
    scope: familyId ? "family" : "system",
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

  await assertRoomFor(db, size, opts.kind, opts.key, opts.familyId ?? undefined);

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
  /** ไม่ส่ง = ตรวจเฉพาะเพดานรวมของระบบ (ใช้กับไฟล์ที่ไม่ได้เป็นของครอบครัวไหน) */
  familyId?: string,
) {
  const cap = maxBytesFor(kind);
  if (size > cap) {
    throw new StorageQuotaError(
      `ไฟล์ใหญ่เกินไป (${formatBytes(size)}) — จำกัดที่ ${formatBytes(cap)} ต่อไฟล์`,
    );
  }

  // เขียนทับไฟล์เดิม = คิดเฉพาะส่วนต่าง ไม่ใช่บวกใหม่ทั้งก้อน
  const existing = key
    ? await db
        .select({ sizeBytes: storageObjects.sizeBytes })
        .from(storageObjects)
        .where(eq(storageObjects.key, key))
        .get()
    : undefined;
  const delta = size - (existing?.sizeBytes ?? 0);

  /**
   * เพดานของครอบครัวมาก่อน เพราะเป็นอันที่ผู้ใช้แก้ได้เอง (ลบไฟล์ของตัวเอง)
   * ถ้าเช็คเพดานระบบก่อน เขาจะได้ข้อความว่า "ระบบเต็ม" ทั้งที่ครอบครัวตัวเอง
   * ใช้ไปเกือบหมดแล้วและลบเองได้
   */
  if (familyId) {
    const family = await getStorageUsage(db, familyId);
    if (family.usedBytes + delta > FAMILY_LIMIT) {
      throw new StorageQuotaError(
        `พื้นที่ของครอบครัวเต็ม (ใช้ไป ${formatBytes(family.usedBytes)} จาก ${formatBytes(FAMILY_LIMIT)}) — ลบไฟล์เก่าออกก่อน`,
      );
    }
  }

  const system = await getStorageUsage(db);
  if (system.usedBytes + delta > STORAGE_LIMIT) {
    throw new StorageQuotaError(
      `พื้นที่เก็บไฟล์ของระบบเต็ม (ใช้ไป ${formatBytes(system.usedBytes)} จาก ${formatBytes(STORAGE_LIMIT)}) — ติดต่อผู้ดูแล`,
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

/**
 * ลบไฟล์ทั้งหมดของครอบครัวออกจาก R2 จริงๆ
 *
 * ⚠️ ต้องเรียกก่อนลบแถว families เสมอ
 *
 * FK เป็น ON DELETE CASCADE อยู่แล้ว แถว storage_objects จึงหายไปพร้อมครอบครัว
 * แต่ **ไฟล์ใน R2 ไม่ได้หายไปด้วย** มันค้างอยู่ตลอดไปโดยไม่มีอะไรอ้างถึง
 * และยังกินโควตา 5 GB ที่ใช้ร่วมกันทั้งแอป โดยไม่มีทางทวงคืนเพราะไม่รู้แล้วว่า
 * ไฟล์ไหนเป็นของใคร (บั๊กนี้มีมาตั้งแต่ deleteFamily รอบแรก เพิ่งเจอตอนทำ PDPA)
 *
 * และในแง่ PDPA การลบข้อมูลต้องลบของจริง ไม่ใช่ลบแค่ดัชนีที่ชี้ไปหามัน
 */
export async function deleteFamilyFiles(db: Db, bucket: R2Bucket, familyId: string) {
  const rows = await db
    .select({ key: storageObjects.key })
    .from(storageObjects)
    .where(eq(storageObjects.familyId, familyId));
  if (rows.length === 0) return 0;

  // R2 รับลบทีละไม่เกิน 1000 key ต่อครั้ง
  const keys = rows.map((r) => r.key);
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
  await db.delete(storageObjects).where(eq(storageObjects.familyId, familyId));
  return keys.length;
}

/** ไฟล์ที่ผู้ใช้อัปโหลดเองและไม่ผูกกับครอบครัวไหน — รูปโปรไฟล์เป็นต้น */
export async function deleteUserFiles(db: Db, bucket: R2Bucket, userId: string) {
  const rows = await db
    .select({ key: storageObjects.key })
    .from(storageObjects)
    .where(and(eq(storageObjects.uploadedBy, userId), isNull(storageObjects.familyId)));
  if (rows.length === 0) return 0;
  const keys = rows.map((r) => r.key);
  for (let i = 0; i < keys.length; i += 1000) await bucket.delete(keys.slice(i, i + 1000));
  await db
    .delete(storageObjects)
    .where(and(eq(storageObjects.uploadedBy, userId), isNull(storageObjects.familyId)));
  return keys.length;
}

/** ลบไฟล์ + ตัดยอดออกจากบัญชี */
export async function deleteObject(db: Db, bucket: R2Bucket, key: string) {
  await bucket.delete(key);
  await db.delete(storageObjects).where(eq(storageObjects.key, key));
}
