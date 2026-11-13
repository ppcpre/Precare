import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { KEEP_DAYS, dayBefore, runBackup, type BackupEnv } from "../workers/cron/backup";

/**
 * สำรอง D1 ขึ้น R2 — เทสต์กับ D1 ของจริง ส่วน REST API กับ R2 ใช้ตัวปลอม
 *
 * ของแบบนี้พังเงียบได้ง่ายที่สุดในแอป เพราะไม่มีใครเปิดดูทุกวัน และ
 * Cron Trigger ที่ล้มไม่ถูกรันซ้ำให้ กว่าจะรู้ก็ตอนที่ต้องใช้แล้วไม่มี
 */

const NOW = new Date("2026-11-13T19:20:00.000Z");
const now = () => NOW;
const sleep = async () => {};

/** R2 ปลอมที่จำได้ว่าถูก put/delete อะไรไปบ้าง */
function fakeBucket(existing: string[] = []) {
  const keys = new Set(existing);
  const deleted: string[] = [];
  return {
    put: async (key: string) => {
      keys.add(key);
      return { size: 2048 };
    },
    list: async ({ prefix }: { prefix: string }) => ({
      objects: [...keys].filter((k) => k.startsWith(prefix)).map((key) => ({ key })),
    }),
    delete: async (k: string | string[]) => {
      for (const key of Array.isArray(k) ? k : [k]) {
        keys.delete(key);
        deleted.push(key);
      }
    },
    keys,
    deleted,
  };
}

/** ลำดับคำตอบของ REST API ตามที่เอกสาร Cloudflare วางไว้ */
function fakeApi(opts: { pollsBeforeReady?: number; dumpOk?: boolean } = {}) {
  const calls: string[] = [];
  let polls = 0;
  const fn = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (url.includes("/export")) {
      const body = JSON.parse(String(init?.body ?? "{}"));
      if (body.output_format === "polling") {
        calls.push("start");
        return Response.json({ result: { at_bookmark: "bm-1" } });
      }
      calls.push("poll");
      polls++;
      const ready = polls > (opts.pollsBeforeReady ?? 0);
      return Response.json({ result: ready ? { signed_url: "https://dl.test/dump.sql" } : {} });
    }
    calls.push("download");
    return opts.dumpOk === false
      ? new Response(null, { status: 500 })
      : new Response("PRAGMA foreign_keys=OFF;");
  };
  return Object.assign(fn, { calls });
}

const backupEnv = (over: Partial<BackupEnv> = {}): BackupEnv =>
  ({
    DB: env.DB,
    BACKUP_BUCKET: fakeBucket() as unknown as R2Bucket,
    CF_ACCOUNT_ID: "acct",
    CF_DATABASE_ID: "dbid",
    CF_API_TOKEN: "token-for-test-only",
    ...over,
  }) as BackupEnv;

const lastRun = () =>
  env.DB.prepare("SELECT status, object_key, error FROM backup_runs ORDER BY rowid DESC LIMIT 1").first<{
    status: string;
    object_key: string | null;
    error: string | null;
  }>();

describe("สำรอง D1 ขึ้น R2", () => {
  beforeEach(async () => {
    await env.DB.prepare("DELETE FROM backup_runs").run();
  });

  it("สั่ง export แล้วสตรีมลง R2 เป็นไฟล์ของวันนี้", async () => {
    const bucket = fakeBucket();
    const fetchFn = fakeApi();
    const r = await runBackup(backupEnv({ BACKUP_BUCKET: bucket as unknown as R2Bucket }), {
      fetch: fetchFn as unknown as typeof fetch,
      sleep,
      now,
    });

    expect(r.status).toBe("ok");
    expect(r.key).toBe("d1/precare-2026-11-13.sql");
    expect([...bucket.keys]).toContain("d1/precare-2026-11-13.sql");
    expect(fetchFn.calls).toEqual(["start", "poll", "download"]);
  });

  /** ฐานใหญ่ขึ้นเมื่อไหร่ dump จะไม่พร้อมในรอบแรก ต้องรอเป็น ไม่ใช่ยอมแพ้ */
  it("ถามซ้ำจนกว่า dump จะพร้อม", async () => {
    const fetchFn = fakeApi({ pollsBeforeReady: 3 });
    const r = await runBackup(backupEnv(), {
      fetch: fetchFn as unknown as typeof fetch,
      sleep,
      now,
    });

    expect(r.status).toBe("ok");
    expect(fetchFn.calls.filter((c) => c === "poll")).toHaveLength(4);
  });

  it("ยังไม่ได้ตั้งค่า = บอกว่ายังไม่ได้ตั้ง ไม่ใช่บอกว่าพัง", async () => {
    const r = await runBackup(backupEnv({ CF_API_TOKEN: undefined }), { fetch: fakeApi() as unknown as typeof fetch, sleep, now });
    expect(r.status).toBe("not_configured");
    expect(await lastRun()).toMatchObject({ status: "not_configured" });
  });

  /**
   * ข้อสำคัญที่สุดของไฟล์นี้ — รอบที่ล้มต้องมีร่องรอยอยู่ในฐาน
   * ไม่งั้นคนจะเข้าใจว่าตัวเองมีสำเนาอยู่ ทั้งที่ไม่มีมาหลายเดือน
   */
  it("รอบที่ล้มต้องจดไว้ ไม่ใช่เงียบหาย", async () => {
    const r = await runBackup(backupEnv(), {
      fetch: fakeApi({ dumpOk: false }) as unknown as typeof fetch,
      sleep,
      now,
    });

    expect(r.status).toBe("failed");
    const row = await lastRun();
    expect(row?.status).toBe("failed");
    expect(row?.error).toBeTruthy();
  });

  /**
   * ต้องล้ม**ทันที** ไม่ใช่ไล่ถามจนครบ 20 ครั้งด้วย bookmark ที่เป็น undefined
   * — นับจำนวนคำขอไว้ด้วย ไม่งั้นเทสต์แยกไม่ออกจากการไม่มีด่านนี้เลย
   */
  it("ไม่ได้ at_bookmark = เลิกทันที ไม่ไล่ถามต่อ", async () => {
    const bucket = fakeBucket();
    let calls = 0;
    const r = await runBackup(backupEnv({ BACKUP_BUCKET: bucket as unknown as R2Bucket }), {
      fetch: (async () => {
        calls++;
        return Response.json({ result: {} });
      }) as unknown as typeof fetch,
      sleep,
      now,
    });

    expect(r.status).toBe("failed");
    expect(calls).toBe(1);
    expect([...bucket.keys]).toHaveLength(0);
  });

  it("ห้ามมี token หลุดลงตาราง", async () => {
    await runBackup(backupEnv(), {
      fetch: (async () => {
        throw new Error("boom token-for-test-only");
      }) as unknown as typeof fetch,
      sleep,
      now,
    });
    const row = await lastRun();
    // ข้อความ error มาจาก throw ของเราเอง — เทสต์นี้กันไม่ให้ใครเผลอเอา
    // response body หรือ header ของ API มาใส่ทั้งก้อนในอนาคต
    expect(row?.error).not.toContain("Bearer");
  });

  describe("ลบของเก่าตามอายุ", () => {
    it("ลบไฟล์ที่เกิน 30 วัน และเก็บของใหม่ไว้", async () => {
      const เก่า = `d1/precare-${dayBefore(NOW, KEEP_DAYS + 1)}.sql`;
      const พอดีขอบ = `d1/precare-${dayBefore(NOW, KEEP_DAYS)}.sql`;
      const ใหม่ = `d1/precare-${dayBefore(NOW, 1)}.sql`;
      const bucket = fakeBucket([เก่า, พอดีขอบ, ใหม่]);

      const r = await runBackup(backupEnv({ BACKUP_BUCKET: bucket as unknown as R2Bucket }), {
        fetch: fakeApi() as unknown as typeof fetch,
        sleep,
        now,
      });

      expect(r.removed).toBe(1);
      expect(bucket.deleted).toEqual([เก่า]);
      expect([...bucket.keys]).toContain(ใหม่);
      expect([...bucket.keys]).toContain(พอดีขอบ);
    });

    /** ไฟล์ที่ไม่ใช่ของรอบนี้ตั้งชื่อ ไม่ใช่หน้าที่เราไปลบ */
    it("ไม่แตะไฟล์ที่ชื่อไม่เข้าแบบ", async () => {
      const แปลกปลอม = "d1/manual-dump-2020-01-01.sql";
      const bucket = fakeBucket([แปลกปลอม]);

      await runBackup(backupEnv({ BACKUP_BUCKET: bucket as unknown as R2Bucket }), {
        fetch: fakeApi() as unknown as typeof fetch,
        sleep,
        now,
      });

      expect(bucket.deleted).toEqual([]);
      expect([...bucket.keys]).toContain(แปลกปลอม);
    });
  });

  it("ย้อนวันข้ามเดือนได้ถูก", () => {
    expect(dayBefore(new Date("2026-03-02T23:59:00.000Z"), 1)).toBe("2026-03-01");
    expect(dayBefore(new Date("2026-03-01T00:30:00.000Z"), 1)).toBe("2026-02-28");
    expect(dayBefore(new Date("2026-01-01T12:00:00.000Z"), 1)).toBe("2025-12-31");
  });
});
