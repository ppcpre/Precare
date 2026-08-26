/**
 * โควตาพื้นที่เก็บไฟล์ — กันบิล R2 บานปลาย
 * เพดานตั้งเองที่ 5 GB (ต่ำกว่า free tier 10 GB) และเตือนที่ 4 GB
 */
import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  MAX_FILE_BYTES,
  STORAGE_LIMIT,
  STORAGE_WARN,
  StorageQuotaError,
  formatBytes,
  getStorageUsage,
  putObject,
} from "@/lib/storage";

const db = drizzle(env.DB, { schema });
const GB = 1024 ** 3;

/** bucket ปลอมที่นับ put/delete ได้ ไม่ต้องยิง R2 จริงในเทสต์ */
function fakeBucket() {
  const store = new Map<string, number>();
  return {
    puts: 0,
    async put(key: string, body: ArrayBuffer) {
      this.puts++;
      store.set(key, body.byteLength);
    },
    async delete(key: string) {
      store.delete(key);
    },
    size: () => store.size,
  };
}

async function seedUsage(bytes: number) {
  await env.DB.exec("DELETE FROM storage_objects");
  if (bytes > 0) {
    await db.insert(schema.storageObjects).values({
      id: "seed",
      bucket: "photos",
      key: "seed/blob",
      sizeBytes: bytes,
      kind: "photo",
    });
  }
}

const buf = (n: number) => new ArrayBuffer(n);

beforeEach(() => seedUsage(0));

describe("getStorageUsage", () => {
  it("ยังไม่ถึงเกณฑ์ = ไม่เตือน ไม่เต็ม", async () => {
    await seedUsage(1 * GB);
    const u = await getStorageUsage(db);
    expect(u.usedBytes).toBe(GB);
    expect(u.warn).toBe(false);
    expect(u.full).toBe(false);
  });

  it("ถึง 4 GB = เริ่มเตือน แต่ยังอัปโหลดได้", async () => {
    await seedUsage(STORAGE_WARN);
    const u = await getStorageUsage(db);
    expect(u.warn).toBe(true);
    expect(u.full).toBe(false);
  });

  it("ถึง 5 GB = เต็ม", async () => {
    await seedUsage(STORAGE_LIMIT);
    const u = await getStorageUsage(db);
    expect(u.full).toBe(true);
    expect(u.percent).toBe(100);
  });
});

describe("putObject — ด่านกันโควตา", () => {
  it("เขียนได้ตามปกติเมื่อพื้นที่เหลือ", async () => {
    const b = fakeBucket();
    await putObject(db, b as unknown as R2Bucket, {
      bucketName: "photos", key: "a.webp", body: buf(1000),
      contentType: "image/webp", kind: "avatar",
    });
    expect(b.puts).toBe(1);
    expect((await getStorageUsage(db)).usedBytes).toBe(1000);
  });

  it("ไฟล์เดี่ยวใหญ่เกินเพดานต่อไฟล์ = ไม่เขียนลง R2 เลย", async () => {
    const b = fakeBucket();
    await expect(
      putObject(db, b as unknown as R2Bucket, {
        bucketName: "photos", key: "big.webp", body: buf(MAX_FILE_BYTES + 1),
        contentType: "image/webp", kind: "photo",
      }),
    ).rejects.toThrow(StorageQuotaError);
    // สำคัญ: ต้องกันก่อนเขียน ไม่ใช่เขียนแล้วค่อยลบ
    expect(b.puts).toBe(0);
  });

  it("พื้นที่จะเกิน 5 GB = ปฏิเสธ และไม่แตะ R2", async () => {
    await seedUsage(STORAGE_LIMIT - 100);
    const b = fakeBucket();
    await expect(
      putObject(db, b as unknown as R2Bucket, {
        bucketName: "photos", key: "x.webp", body: buf(500),
        contentType: "image/webp", kind: "photo",
      }),
    ).rejects.toThrow(/เต็ม/);
    expect(b.puts).toBe(0);
  });

  it("เขียนทับไฟล์เดิมคิดเฉพาะส่วนต่าง ไม่บวกซ้ำ", async () => {
    const b = fakeBucket();
    const put = (n: number) =>
      putObject(db, b as unknown as R2Bucket, {
        bucketName: "photos", key: "same.webp", body: buf(n),
        contentType: "image/webp", kind: "avatar",
      });

    await put(1000);
    await put(1500);
    // ถ้าคิดผิดจะได้ 2500 — ต้องได้ 1500 เพราะเป็นไฟล์เดิมที่ถูกทับ
    expect((await getStorageUsage(db)).usedBytes).toBe(1500);
  });

  it("ไฟล์เดิมที่เล็กลง ยอดต้องลดตาม", async () => {
    const b = fakeBucket();
    const put = (n: number) =>
      putObject(db, b as unknown as R2Bucket, {
        bucketName: "photos", key: "s.webp", body: buf(n),
        contentType: "image/webp", kind: "avatar",
      });
    await put(4000);
    await put(1000);
    expect((await getStorageUsage(db)).usedBytes).toBe(1000);
  });
});

describe("formatBytes", () => {
  it("อ่านออกในหน่วยที่เหมาะสม", () => {
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(2048)).toBe("2 KB");
    expect(formatBytes(3 * 1024 ** 2)).toBe("3.0 MB");
    expect(formatBytes(4 * GB)).toBe("4.00 GB");
  });
});
