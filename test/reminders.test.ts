import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { bangkokNow, dueAppointments, runReminders, type CronEnv } from "../workers/cron/reminders";
import type { PushResult } from "@/lib/push";

/**
 * ตัวจับเวลาเตือนนัด — เทสต์กับ D1 ของจริง ส่วนการยิง push ใช้ตัวปลอม
 *
 * ของแบบนี้ผิดแล้วน่ารำคาญมาก (เตือนซ้ำ ๆ กลางดึก หรือเงียบไปเลย)
 * และไม่มีทางเห็นจากการกดลองเอง เพราะต้องรอเวลาจริง
 */
const KEYS = {
  VAPID_PUBLIC_KEY: "pub",
  VAPID_PRIVATE_KEY: "priv",
  VAPID_SUBJECT: "mailto:test@example.com",
};
const cronEnv = (over: Partial<CronEnv> = {}): CronEnv =>
  ({ DB: env.DB, ...KEYS, ...over }) as CronEnv;

/** 25 ก.ย. 2569 10:00 ตามเวลาไทย = 03:00 UTC */
const NOW = Date.UTC(2026, 8, 25, 3, 0, 0);
const at = (local: string) => local;

async function seed(rows: {
  id: string;
  when: string;
  minutes?: number[];
  enabled?: boolean;
  sentAt?: string | null;
}[]) {
  await env.DB.prepare("DELETE FROM appointment_reminders").run();
  await env.DB.prepare("DELETE FROM appointments").run();
  await env.DB.prepare("DELETE FROM push_subscriptions").run();
  await env.DB.prepare("DELETE FROM family_members").run();
  await env.DB.prepare("DELETE FROM families").run();
  await env.DB.prepare("DELETE FROM user").run();

  await env.DB.prepare(
    "INSERT INTO user (id, name, email, email_verified, created_at, updated_at) VALUES ('u1','แม่','m@test.dev',0,0,0)",
  ).run();
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_id) VALUES ('f1','ครอบครัวทดสอบ','u1')",
  ).run();
  await env.DB.prepare(
    "INSERT INTO family_members (id, family_id, user_id, role, status) VALUES ('m1','f1','u1','owner','active')",
  ).run();

  for (const r of rows) {
    await env.DB.prepare(
      `INSERT INTO appointments (id, family_id, created_by, appt_datetime, reminder_enabled)
       VALUES (?1,'f1','u1',?2,?3)`,
    )
      .bind(r.id, r.when, r.enabled === false ? 0 : 1)
      .run();

    // เวลาเตือนอยู่ตารางลูก หนึ่งนัดมีได้หลายครั้ง
    for (const m of r.minutes ?? [60]) {
      await env.DB.prepare(
        `INSERT INTO appointment_reminders (id, appointment_id, minutes_before, sent_at)
         VALUES (?1,?2,?3,?4)`,
      )
        .bind(`${r.id}-${m}`, r.id, m, r.sentAt ?? null)
        .run();
    }
  }
}

const addSub = (id: string, endpoint: string) =>
  env.DB.prepare(
    "INSERT INTO push_subscriptions (id, user_id, endpoint) VALUES (?1,'u1',?2)",
  )
    .bind(id, endpoint)
    .run();

describe("หานัดที่ถึงเวลาเตือน", () => {
  beforeEach(async () => {
    await seed([
      // เตือนก่อน 60 นาที — ตอนนี้ 10:00 นัด 10:30 = ถึงเวลาแล้ว
      { id: "a-due", when: at("2026-09-25T10:30:00") },
      // นัดอีก 5 ชั่วโมง ยังไม่ถึงเวลาเตือน
      { id: "a-later", when: at("2026-09-25T15:00:00") },
      // ผ่านไปแล้ว ไม่ต้องเตือน
      { id: "a-past", when: at("2026-09-25T09:00:00") },
      // ปิดเตือนไว้
      { id: "a-off", when: at("2026-09-25T10:30:00"), enabled: false },
      // เตือนไปแล้ว
      { id: "a-sent", when: at("2026-09-25T10:30:00"), sentAt: "2026-09-25T02:00:00.000Z" },
    ]);
  });

  it("หยิบเฉพาะนัดที่ถึงเวลาเตือนจริง", async () => {
    const rows = await dueAppointments(env.DB, bangkokNow(NOW));
    expect(rows.map((r) => r.id)).toEqual(["a-due"]);
  });

  /** ถ้าลืมบวก 7 ชั่วโมง นัดบ่ายจะถูกเตือนตั้งแต่เช้า ซึ่งแย่กว่าไม่เตือน */
  it("เทียบด้วยเวลาไทย ไม่ใช่ UTC", async () => {
    expect(bangkokNow(NOW)).toBe("2026-09-25T10:00:00");
    // ถ้าใช้ UTC ตรงๆ (03:00) นัด 15:00 จะยังไม่ถึงคิวเหมือนกัน แต่ a-due จะหลุด
    const utcRows = await dueAppointments(env.DB, new Date(NOW).toISOString().slice(0, 19));
    expect(utcRows.map((r) => r.id)).not.toContain("a-due");
  });
});

describe("ยิงเตือน", () => {
  beforeEach(async () => {
    await seed([{ id: "a-due", when: at("2026-09-25T10:30:00") }]);
  });

  /**
   * หัวใจของการเตือนได้สามครั้ง — แต่ละครั้งต้องยิงแยกกันตามเวลาของตัวเอง
   * และครั้งที่ยิงไปแล้วต้องไม่ถูกยิงซ้ำ ขณะที่ครั้งที่เหลือยังต้องรอคิวอยู่
   */
  it("นัดเดียวสามเวลา ยิงทีละครั้งตามเวลาของมัน ไม่ยิงซ้ำและไม่ข้าม", async () => {
    // นัด 12:00 · เตือนก่อน 1 วัน / 2 ชม. / 30 นาที
    await seed([{ id: "a3", when: at("2026-09-25T12:00:00"), minutes: [1440, 120, 30] }]);
    await addSub("s1", "https://push.test/1");

    const at10 = Date.UTC(2026, 8, 25, 3, 0); // 10:00 ไทย — ถึงคิวแค่ 1 วันกับ 2 ชม.
    const hits: number[] = [];
    const send = async () => {
      hits.push(1);
      return { ok: true } as PushResult;
    };

    const first = await runReminders(cronEnv(), { now: at10, send });
    expect(first.due).toBe(2);
    expect(first.sent).toBe(2);

    // รอบถัดไปในนาทีเดียวกัน ต้องไม่มีอะไรค้างให้ยิงอีก
    const again = await runReminders(cronEnv(), { now: at10 + 300_000, send });
    expect(again.due).toBe(0);

    // 11:35 ไทย — ถึงคิวของ 30 นาที
    const at1135 = Date.UTC(2026, 8, 25, 4, 35);
    const last = await runReminders(cronEnv(), { now: at1135, send });
    expect(last.due).toBe(1);
    expect(hits).toHaveLength(3);
  });

  /** เลยเวลานัดไปแล้วแต่ไม่เคยยิง ต้องถูกเก็บกวาด ไม่ค้างใน index ตลอดกาล */
  it("ครั้งที่เลยเวลานัดไปแล้วถูกปิดทิ้ง ไม่วนกลับมาทุกรอบ", async () => {
    await seed([{ id: "a-old", when: at("2026-09-25T09:00:00"), minutes: [60] }]);
    await runReminders(cronEnv(), { now: NOW, send: async () => ({ ok: true }) });

    const left = await env.DB.prepare(
      "SELECT count(*) AS n FROM appointment_reminders WHERE sent_at IS NULL",
    ).first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("ส่งให้ทุกคนในครอบครัวที่เปิดไว้ แล้วทำเครื่องหมายว่าเตือนแล้ว", async () => {
    await addSub("s1", "https://push.test/1");
    await addSub("s2", "https://push.test/2");

    const hit: string[] = [];
    const res = await runReminders(cronEnv(), {
      now: NOW,
      send: async (o) => {
        hit.push(o.endpoint);
        return { ok: true } as PushResult;
      },
    });

    expect(res).toMatchObject({ due: 1, sent: 2, removed: 0 });
    expect(hit.sort()).toEqual(["https://push.test/1", "https://push.test/2"]);

    // รอบถัดไปต้องไม่ยิงซ้ำ
    const again = await runReminders(cronEnv(), { now: NOW + 300_000, send: async () => ({ ok: true }) });
    expect(again.due).toBe(0);
  });

  it("ไม่มีใครเปิดแจ้งเตือน ก็ยังทำเครื่องหมายว่าจบรอบนี้แล้ว", async () => {
    const res = await runReminders(cronEnv(), { now: NOW, send: async () => ({ ok: true }) });
    expect(res).toMatchObject({ due: 1, sent: 0 });
    const again = await dueAppointments(env.DB, bangkokNow(NOW + 300_000));
    expect(again).toHaveLength(0);
  });

  it("subscription ที่ตายแล้ว (404/410) ถูกลบทิ้ง", async () => {
    await addSub("s1", "https://push.test/dead");
    const res = await runReminders(cronEnv(), {
      now: NOW,
      send: async () => ({ ok: false, gone: true, status: 410 }),
    });
    expect(res.removed).toBe(1);
    const left = await env.DB.prepare("SELECT count(*) AS n FROM push_subscriptions").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  it("เซิร์ฟเวอร์ push ล่ม ไม่ทำให้ทั้งรอบพัง", async () => {
    await addSub("s1", "https://push.test/boom");
    await addSub("s2", "https://push.test/ok");
    const res = await runReminders(cronEnv(), {
      now: NOW,
      send: async (o) => {
        if (o.endpoint.endsWith("boom")) throw new Error("network");
        return { ok: true };
      },
    });
    expect(res.sent).toBe(1);
  });

  /** ยังไม่ได้ตั้ง secret — ห้ามทำเครื่องหมายว่าเตือนแล้ว ไม่งั้นนัดนั้นเงียบตลอดไป */
  it("ไม่มีกุญแจ VAPID = ออกเงียบๆ และไม่กินนัดทิ้ง", async () => {
    await addSub("s1", "https://push.test/1");
    const res = await runReminders(cronEnv({ VAPID_PRIVATE_KEY: undefined }), {
      now: NOW,
      send: async () => {
        throw new Error("ต้องไม่ถูกเรียก");
      },
    });
    expect(res.skipped).toBe("no-key");
    expect(await dueAppointments(env.DB, bangkokNow(NOW))).toHaveLength(1);
  });
});
