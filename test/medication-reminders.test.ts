import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { LATE_MINUTES, dueDoses, runMedicationReminders } from "../workers/cron/medications";
import type { CronEnv } from "../workers/cron/reminders";
import type { PushResult } from "@/lib/push";

/**
 * ตัวจับเวลาเตือนกินยา — เทสต์กับ D1 จริง ส่วนการยิง push ใช้ตัวปลอม
 *
 * ของแบบนี้ผิดแล้วไม่มีใครเห็นจนกว่าจะสาย: เตือนซ้ำทุก 5 นาที หรือเงียบไปเลย
 * และยาเป็นของที่ "ไม่เตือน" แปลว่าคนลืมกินจริงๆ ไม่ใช่แค่หน้าจอไม่สวย
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
const TODAY = "2026-09-25";

const okPush = async (): Promise<PushResult> => ({ ok: true });

async function seed(
  meds: {
    id: string;
    times: string[];
    userId?: string;
    active?: boolean;
    startOn?: string;
    endOn?: string | null;
  }[],
) {
  for (const t of ["medication_doses", "medication_times", "medications", "push_subscriptions",
                   "family_members", "families", "user"]) {
    await env.DB.prepare(`DELETE FROM ${t}`).run();
  }
  await env.DB.prepare(
    `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
     VALUES ('u1','แม่','m@test.dev',0,0,0), ('u2','พ่อ','d@test.dev',0,0,0)`,
  ).run();
  await env.DB.prepare(
    "INSERT INTO families (id, name, owner_id) VALUES ('f1','ครอบครัวทดสอบ','u1')",
  ).run();
  await env.DB.prepare(
    `INSERT INTO family_members (id, family_id, user_id, role, status)
     VALUES ('m1','f1','u1','owner','active'), ('m2','f1','u2','editor','active')`,
  ).run();

  for (const m of meds) {
    await env.DB.prepare(
      `INSERT INTO medications (id, family_id, user_id, name, start_on, end_on, active, created_by)
       VALUES (?1,'f1',?2,'โฟลิก',?3,?4,?5,?2)`,
    )
      .bind(m.id, m.userId ?? "u1", m.startOn ?? "2026-01-01", m.endOn ?? null,
            m.active === false ? 0 : 1)
      .run();
    for (const at of m.times) {
      await env.DB.prepare(
        "INSERT INTO medication_times (id, medication_id, at) VALUES (?1,?2,?3)",
      )
        .bind(`${m.id}-${at}`, m.id, at)
        .run();
    }
  }
}

const addDevice = (id: string, userId = "u1") =>
  env.DB.prepare(
    "INSERT INTO push_subscriptions (id, user_id, endpoint) VALUES (?1,?2,?3)",
  )
    .bind(id, userId, `https://push.test/${id}`)
    .run();

const doses = async () =>
  (await env.DB.prepare("SELECT medication_time_id, sent_at, taken_at FROM medication_doses").all())
    .results as { medication_time_id: string; sent_at: string | null; taken_at: string | null }[];

describe("เลือกยาที่ถึงเวลาเตือน", () => {
  beforeEach(() => seed([{ id: "med1", times: ["08:00", "12:00", "20:00"] }]));

  it("เอาเฉพาะเวลาที่ถึงแล้ว ไม่ใช่ทั้งวัน", async () => {
    const rows = await dueDoses(env.DB, TODAY, "10:00", "09:00");
    expect(rows).toHaveLength(0); // 08:00 เลยช่วง late ไปแล้ว 12:00 ยังไม่ถึง
    expect(await dueDoses(env.DB, TODAY, "12:05", "11:05")).toHaveLength(1);
  });

  /** cron รันทุก 5 นาที พลาดรอบได้ แต่ไม่ควรเตือนย้อนหลังข้ามวัน */
  it("เวลาที่เลยมานานเกินช่วงผ่อนผันไม่ถูกหยิบมาเตือน", async () => {
    expect(await dueDoses(env.DB, TODAY, "23:00", "22:00")).toHaveLength(0);
  });

  it("ยาที่หยุดไว้ หรือยังไม่เริ่ม หรือจบไปแล้ว ไม่ถูกหยิบ", async () => {
    await seed([
      { id: "stopped", times: ["08:00"], active: false },
      { id: "future", times: ["08:00"], startOn: "2026-12-01" },
      { id: "ended", times: ["08:00"], endOn: "2026-09-24" },
      { id: "live", times: ["08:00"], endOn: "2026-09-25" },
    ]);
    const rows = await dueDoses(env.DB, TODAY, "08:30", "07:30");
    expect(rows.map((r) => r.medication_id)).toEqual(["live"]);
  });

  it("ติ๊กว่ากินแล้วก่อนถึงเวลา ต้องไม่ถูกเตือนอีก", async () => {
    await env.DB.prepare(
      `INSERT INTO medication_doses (id, medication_time_id, due_on, taken_at)
       VALUES ('d1','med1-12:00',?1,'2026-09-25T11:00:00')`,
    )
      .bind(TODAY)
      .run();
    expect(await dueDoses(env.DB, TODAY, "12:05", "11:05")).toHaveLength(0);
  });
});

describe("ยิงเตือนกินยา", () => {
  beforeEach(async () => {
    await seed([{ id: "med1", times: ["09:30"] }]);
    await addDevice("s1");
  });

  it("ยิงหาเครื่องของเจ้าของยา แล้วทำเครื่องหมายว่าเตือนแล้ว", async () => {
    const r = await runMedicationReminders(cronEnv(), { now: NOW, send: okPush });
    expect(r).toMatchObject({ due: 1, sent: 1 });

    const rows = await doses();
    expect(rows).toHaveLength(1);
    expect(rows[0].sent_at).not.toBeNull();
    expect(rows[0].taken_at).toBeNull();
  });

  /** ถ้าไม่ทำเครื่องหมาย จะถูกหยิบใหม่ทุก 5 นาทีจนพ้นช่วงผ่อนผัน */
  it("รันซ้ำรอบถัดไปต้องไม่ยิงซ้ำ", async () => {
    await runMedicationReminders(cronEnv(), { now: NOW, send: okPush });
    const again = await runMedicationReminders(cronEnv(), { now: NOW + 300_000, send: okPush });
    expect(again).toMatchObject({ due: 0, sent: 0 });
    expect(await doses()).toHaveLength(1);
  });

  it("ยาของคนอื่นในครอบครัวไม่ยิงเข้าเครื่องเรา", async () => {
    await seed([{ id: "dad", times: ["09:30"], userId: "u2" }]);
    await addDevice("s1", "u1"); // มีแต่เครื่องของแม่
    const r = await runMedicationReminders(cronEnv(), { now: NOW, send: okPush });
    expect(r).toMatchObject({ due: 1, sent: 0 });
  });

  /**
   * ด่านสำคัญที่สุดของฟีเจอร์นี้ — ยาที่คนหนึ่งกินบอกถึงโรคประจำตัวได้ตรงๆ
   * การตั้งเตือนไม่ใช่การยินยอมให้ทั้งบ้านรู้
   *
   * ต่างจากเตือนนัดที่ยิงทั้งครอบครัวโดยตั้งใจ (นัดเป็นเรื่องที่ไปด้วยกัน)
   * เทสต์นี้จึงต้องมีเครื่องของทั้งสองคนอยู่จริง ไม่ใช่มีแต่เครื่องเดียว
   */
  it("มีเครื่องของทั้งสองคน ยาของแม่ต้องเข้าเครื่องแม่เครื่องเดียว", async () => {
    await seed([{ id: "mom", times: ["09:30"], userId: "u1" }]);
    await addDevice("mom-phone", "u1");
    await addDevice("dad-phone", "u2");

    const hit: string[] = [];
    const spy = async (o: { endpoint: string }): Promise<PushResult> => {
      hit.push(o.endpoint);
      return { ok: true };
    };

    const r = await runMedicationReminders(cronEnv(), { now: NOW, send: spy });
    expect(r).toMatchObject({ due: 1, sent: 1 });
    expect(hit).toEqual(["https://push.test/mom-phone"]);
  });

  it("เครื่องที่ถอนการติดตั้งแล้วถูกลบทิ้ง", async () => {
    const gone = async (): Promise<PushResult> => ({ ok: false, status: 410, gone: true });
    const r = await runMedicationReminders(cronEnv(), { now: NOW, send: gone });
    expect(r.removed).toBe(1);
    const left = await env.DB.prepare("SELECT count(*) AS n FROM push_subscriptions").first<{ n: number }>();
    expect(left?.n).toBe(0);
  });

  /** ยังไม่ได้ตั้ง secret — ต้องเงียบ และห้ามทำเครื่องหมายว่าเตือนแล้ว */
  it("ไม่มีคีย์ VAPID ต้องไม่ทำเครื่องหมายว่าเตือนแล้ว", async () => {
    const r = await runMedicationReminders(
      cronEnv({ VAPID_PRIVATE_KEY: undefined }),
      { now: NOW, send: okPush },
    );
    expect(r.skipped).toBe("no-key");
    expect(await doses()).toHaveLength(0);
  });

  it("ช่วงผ่อนผันคือหนึ่งชั่วโมง", () => {
    expect(LATE_MINUTES).toBe(60);
  });
});
