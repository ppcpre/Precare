/**
 * เตือนบันทึกลูก + ไทม์ไลน์ 7 วัน — กติกาล้วน และ cron กับ D1 จริง
 *
 * เตือนผิดตอนตีสามแย่กว่าไม่เตือน: ปลุกทั้งบ้านจากบันทึกเดิมซ้ำ หรือเด้งในช่วงงดเตือน
 */
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import {
  cronDecision,
  everyLabel,
  inQuiet,
  pushOutOfQuiet,
  reminderState,
} from "@/lib/baby-reminder";
import { rangeLabel, weekDays, weekStats, weekdayLabel } from "@/lib/baby-week";
import type { BabyLogView } from "@/lib/baby-log";
import type { PushResult } from "@/lib/push";
import { runBabyReminders } from "../workers/cron/baby";
import type { CronEnv } from "../workers/cron/reminders";

const rule = (p: Partial<{ everyMin: number; quietFrom: string | null; quietTo: string | null }> = {}) => ({
  everyMin: 180,
  quietFrom: null,
  quietTo: null,
  ...p,
});

describe("ช่วงงดเตือน", () => {
  it("ข้ามเที่ยงคืนได้", () => {
    expect(inQuiet("23:30", "23:00", "07:00")).toBe(true);
    expect(inQuiet("03:00", "23:00", "07:00")).toBe(true);
    expect(inQuiet("07:00", "23:00", "07:00")).toBe(false);
    expect(inQuiet("12:00", "23:00", "07:00")).toBe(false);
    expect(inQuiet("13:00", "12:00", "14:00")).toBe(true);
  });

  it("ครบกำหนดก่อนเที่ยงคืนในช่วงงด เลื่อนไปเช้าวันถัดไป", () => {
    expect(pushOutOfQuiet("2026-11-22T23:40:00", rule({ quietFrom: "23:00", quietTo: "07:00" }))).toBe(
      "2026-11-23T07:00:00",
    );
  });

  it("ครบกำหนดหลังเที่ยงคืนในช่วงงด เลื่อนไปเช้าวันเดียวกัน", () => {
    expect(pushOutOfQuiet("2026-11-23T03:10:00", rule({ quietFrom: "23:00", quietTo: "07:00" }))).toBe(
      "2026-11-23T07:00:00",
    );
  });

  it("นอกช่วงงด หรือไม่ได้ตั้งช่วงงด ไม่เลื่อน", () => {
    expect(pushOutOfQuiet("2026-11-23T09:00:00", rule({ quietFrom: "23:00", quietTo: "07:00" }))).toBe(
      "2026-11-23T09:00:00",
    );
    expect(pushOutOfQuiet("2026-11-23T03:00:00", rule())).toBe("2026-11-23T03:00:00");
  });
});

describe("สถานะของการแจ้งเตือน", () => {
  const log = (p: Partial<BabyLogView>) =>
    ({ kind: "pump", startedAt: "2026-11-22T14:20:00", endedAt: "2026-11-22T14:20:00", ...p }) as BabyLogView;

  it("ปิด · ยังไม่เคยบันทึก · กำลังจับเวลา", () => {
    expect(reminderState(false, log({}), rule()).status).toBe("off");
    expect(reminderState(true, null, rule()).status).toBe("no-log");
    expect(reminderState(true, log({ kind: "breast", endedAt: null }), rule()).status).toBe("running");
  });

  it("นับจากครั้งล่าสุด", () => {
    expect(reminderState(true, log({}), rule())).toMatchObject({
      status: "due",
      anchor: "2026-11-22T14:20:00",
      at: "2026-11-22T17:20:00",
      shifted: false,
    });
  });

  it("นอนนับจากตอนตื่น ไม่ใช่ตอนเริ่มนอน", () => {
    const s = reminderState(
      true,
      log({ kind: "sleep", startedAt: "2026-11-22T10:00:00", endedAt: "2026-11-22T12:00:00" }),
      rule({ everyMin: 120 }),
    );
    expect(s).toMatchObject({ status: "due", at: "2026-11-22T14:00:00" });
  });

  it("cron: ยิงครั้งเดียวต่อบันทึก และไม่ยิงที่เลยมานานแล้ว", () => {
    const s = reminderState(true, log({}), rule());
    expect(cronDecision(s, null, "2026-11-22T17:00:00")).toBe("wait");
    expect(cronDecision(s, null, "2026-11-22T17:25:00")).toBe("send");
    expect(cronDecision(s, "2026-11-22T14:20:00", "2026-11-22T17:30:00")).toBe("wait");
    expect(cronDecision(s, null, "2026-11-22T19:00:00")).toBe("skip");
  });

  it("ป้ายช่วงเวลา", () => {
    expect(everyLabel(180)).toBe("ทุก 3 ชม.");
    expect(everyLabel(150)).toBe("ทุก 2.5 ชม.");
  });
});

describe("ไทม์ไลน์ 7 วัน", () => {
  const r = (p: Partial<BabyLogView>): BabyLogView => ({
    id: crypto.randomUUID(),
    childId: "c1",
    kind: "diaper",
    startedAt: "2026-11-22T10:00:00",
    endedAt: "2026-11-22T10:00:00",
    leftSec: null,
    rightSec: null,
    side: null,
    sideStartedAt: null,
    ml: null,
    milk: null,
    leftMl: null,
    rightMl: null,
    diaper: "wet",
    note: null,
    createdBy: "u1",
    createdByName: null,
    ...p,
  });

  it("เฉลี่ยด้วยวันที่มีบันทึกจริง ไม่ใช่ 7 เสมอ", () => {
    const rows = [
      r({ startedAt: "2026-11-22T08:00:00", endedAt: "2026-11-22T08:00:00" }),
      r({ startedAt: "2026-11-22T11:00:00", endedAt: "2026-11-22T11:00:00", diaper: "both" }),
      r({ startedAt: "2026-11-21T08:00:00", endedAt: "2026-11-21T08:00:00", diaper: "dirty" }),
      r({ kind: "bottle", diaper: null, ml: 90, startedAt: "2026-11-21T09:00:00", endedAt: "2026-11-21T09:00:00" }),
      r({ kind: "sleep", diaper: null, startedAt: "2026-11-21T13:00:00", endedAt: "2026-11-21T16:05:00" }),
    ];
    const s = weekStats(rows, weekDays("2026-11-22"), "2026-11-22T20:00:00");
    expect(s.days).toBe(2);
    expect(s.wet).toBe(1); // ฉี่ 2 ผืนใน 2 วัน
    expect(s.feeds).toBe(0.5);
    expect(s.longestSleepSec).toBe(3 * 3600 + 5 * 60);
  });

  it("ป้ายวันและช่วง", () => {
    expect(weekDays("2026-11-22")).toHaveLength(7);
    expect(weekDays("2026-11-22")[6]).toBe("2026-11-16");
    expect(rangeLabel("2026-11-16", "2026-11-22")).toBe("16 – 22 พ.ย.");
    expect(rangeLabel("2026-10-28", "2026-11-03")).toBe("28 ต.ค. – 3 พ.ย.");
    expect(weekdayLabel("2026-11-22")).toBe("อา. 22");
  });
});

// ---------- cron กับ D1 จริง ----------

const KEYS = { VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv", VAPID_SUBJECT: "mailto:test@example.com" };
const cronEnv = (): CronEnv => ({ DB: env.DB, ...KEYS }) as CronEnv;
/** 22 พ.ย. 2569 17:25 เวลาไทย = 10:25 UTC */
const NOW = Date.UTC(2026, 10, 22, 10, 25, 0);

async function seed() {
  for (const t of ["baby_reminders", "baby_logs", "children", "push_subscriptions", "family_members", "families", "user"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await env.DB.prepare(
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
     VALUES ('u1','แม่','m@test.dev',0,0,0), ('u2','พ่อ','d@test.dev',0,0,0)`,
  ).run();
  await env.DB.prepare("INSERT INTO families (id, name, owner_id) VALUES ('f1','บ้าน','u1')").run();
  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, user_id, role, status)
     VALUES ('m1','f1','u1','owner','active'), ('m2','f1','u2','editor','active')`,
  ).run();
  await env.DB.prepare(
    "INSERT INTO children (id, family_id, name, birth_date, created_by) VALUES ('c1','f1','ต้องตา','2026-11-02','u1')",
  ).run();
  await env.DB.prepare(
    `INSERT INTO push_subscriptions (id, user_id, endpoint)
     VALUES ('s1','u1','https://push.test/s1'), ('s2','u2','https://push.test/s2')`,
  ).run();
}

const addLog = (kind: string, childId: string | null, at: string, endedAt: string | null = at) =>
  env.DB.prepare(
    `INSERT INTO baby_logs (id, family_id, child_id, kind, started_at, ended_at, created_by)
     VALUES (?1,'f1',?2,?3,?4,?5,'u1')`,
  )
    .bind(crypto.randomUUID(), childId, kind, at, endedAt)
    .run();

const addReminder = (id: string, kind: string, childId: string | null, every = 180, userId = "u1") =>
  env.DB.prepare(
    `INSERT INTO baby_reminders (id, family_id, user_id, child_id, kind, every_min)
     VALUES (?1,'f1',?2,?3,?4,?5)`,
  )
    .bind(id, userId, childId, kind, every)
    .run();

describe("cron เตือนบันทึกลูก", () => {
  beforeEach(seed);

  it("ยิงเข้าเครื่องคนตั้งเท่านั้น และไม่ยิงซ้ำจากบันทึกเดิม", async () => {
    await addLog("pump", null, "2026-11-22T14:20:00");
    await addReminder("r1", "pump", null);
    const endpoints: string[] = [];
    const send = async (o: { endpoint: string }): Promise<PushResult> => {
      endpoints.push(o.endpoint);
      return { ok: true };
    };

    expect(await runBabyReminders(cronEnv(), { now: NOW, send })).toMatchObject({ due: 1, sent: 1 });
    expect(endpoints).toEqual(["https://push.test/s1"]);

    const again = await runBabyReminders(cronEnv(), { now: NOW + 300_000, send });
    expect(again).toMatchObject({ due: 0, sent: 0 });

    // บันทึกใหม่ = นับรอบใหม่ ยังไม่ถึงเวลา
    await addLog("pump", null, "2026-11-22T17:30:00");
    expect(await runBabyReminders(cronEnv(), { now: NOW + 600_000, send })).toMatchObject({ due: 0 });
  });

  it("กำลังให้นมอยู่ไม่เตือน · ลูกคนอื่นไม่ปน", async () => {
    await env.DB.prepare(
      "INSERT INTO children (id, family_id, name, birth_date, created_by) VALUES ('c2','f1','ต้นกล้า','2026-11-02','u1')",
    ).run();
    await addLog("breast", "c1", "2026-11-22T13:00:00");
    await addLog("breast", "c1", "2026-11-22T17:10:00", null);
    await addLog("breast", "c2", "2026-11-22T14:20:00");
    await addReminder("r1", "breast", "c1");
    await addReminder("r2", "breast", "c2");
    const r = await runBabyReminders(cronEnv(), { now: NOW, send: async () => ({ ok: true }) });
    expect(r).toMatchObject({ due: 1 });
    const sent = await env.DB.prepare("SELECT id FROM baby_reminders WHERE last_sent_at IS NOT NULL").all();
    expect(sent.results.map((x) => x.id)).toEqual(["r2"]);
  });

  it("เลยเวลามานาน จดว่าจัดการแล้วแต่ไม่ยิง", async () => {
    await addLog("diaper", "c1", "2026-11-22T10:00:00");
    await addReminder("r1", "diaper", "c1", 120);
    const r = await runBabyReminders(cronEnv(), { now: NOW, send: async () => ({ ok: true }) });
    expect(r).toMatchObject({ due: 0, sent: 0, skippedLate: 1 });
  });

  it("ออกจากครอบครัวแล้วไม่ได้รับเตือนอีก", async () => {
    await addLog("pump", null, "2026-11-22T14:20:00");
    await addReminder("r1", "pump", null, 180, "u2");
    await env.DB.prepare("UPDATE family_members SET status = 'removed' WHERE id = 'm2'").run();
    const r = await runBabyReminders(cronEnv(), { now: NOW, send: async () => ({ ok: true }) });
    expect(r).toMatchObject({ due: 0, sent: 0 });
  });
});
