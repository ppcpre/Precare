/**
 * ยาของลูก (กันให้ซ้ำ) และการ์ดไข้ของลูกวัยแรกเกิด
 *
 * ให้ยาลดไข้ซ้ำเพราะพ่อกับแม่ไม่รู้ว่าอีกคนเพิ่งให้ คือเหตุผลเดียวที่หน้านี้มี
 * ส่วนการ์ดไข้ต้องยกข้อความจากหน้าอาการคำต่อคำ ห้ามมีฉบับที่สอง
 */
import { beforeEach, describe, expect, it } from "vitest";
import { env } from "cloudflare:test";
import { dueSlots } from "@/lib/child-meds";
import { runChildMedReminders } from "../workers/cron/child-meds";
import type { CronEnv } from "../workers/cron/reminders";
import { doseWarning, parseTimes, ruleLabel, type DoseView } from "@/lib/child-meds";
import { isYoungInfant, newbornSection, newbornSignTable, newbornSignsFor } from "@/lib/child-temp";

const dose = (givenAt: string, givenBy = "u2"): DoseView => ({
  id: crypto.randomUUID(),
  givenAt,
  givenBy,
  givenByName: "พ่อ",
});

describe("กันให้ยาซ้ำ", () => {
  const prn = { mode: "prn" as const, minGapMin: 240, times: null };

  it("ยาตามอาการ: ยังไม่ถึงช่วงห่างที่ตั้งไว้ = ถามก่อน พร้อมข้อเท็จจริง", () => {
    const w = doseWarning(prn, [dose("2026-11-22T13:55:00")], "2026-11-22T14:35:00");
    expect(w).toMatchObject({ gapMin: 240, sinceSec: 40 * 60 });
    expect(w?.last.givenByName).toBe("พ่อ");
  });

  it("ยาตามอาการ: ครบช่วงห่างแล้ว หรือยังไม่เคยให้ = ไม่ถาม", () => {
    expect(doseWarning(prn, [dose("2026-11-22T10:15:00")], "2026-11-22T14:35:00")).toBeNull();
    expect(doseWarning(prn, [], "2026-11-22T14:35:00")).toBeNull();
  });

  it("ยาประจำ: วันนี้ให้ครบตามจำนวนเวลาแล้ว = ถาม · เมื่อวานไม่นับ", () => {
    const daily = { mode: "daily" as const, minGapMin: null, times: "09:00,21:00" };
    const now = "2026-11-22T21:30:00";
    expect(doseWarning(daily, [dose("2026-11-22T09:05:00")], now)).toBeNull();
    expect(
      doseWarning(daily, [dose("2026-11-22T21:00:00"), dose("2026-11-22T09:05:00")], now),
    ).toMatchObject({ today: { given: 2, planned: 2 } });
    expect(doseWarning(daily, [dose("2026-11-21T21:00:00"), dose("2026-11-21T09:00:00")], now)).toBeNull();
  });

  it("ป้ายวิธีให้ยา", () => {
    expect(parseTimes("21:00, 09:00,xx")).toEqual(["09:00", "21:00"]);
    expect(ruleLabel({ ...prn, dose: "1.2 มล." })).toBe("ครั้งละ 1.2 มล. · ให้ตามอาการ · ห่างกันอย่างน้อย 4 ชม.");
    expect(ruleLabel({ mode: "daily", minGapMin: null, times: "09:00", dose: null })).toBe("วันละครั้ง · 09:00");
  });
});

describe("การ์ดไข้ลูกวัยแรกเกิด", () => {
  it("อายุตามขอบของหมวดในหน้าอาการ (2 เดือน)", () => {
    expect(isYoungInfant("2026-10-01", "2026-11-30")).toBe(true);
    expect(isYoungInfant("2026-10-01", "2026-12-01")).toBe(false);
  });

  it("ยกข้อความจากหน้าอาการ ไม่แต่งเอง", () => {
    const labels = newbornSection().signs.map((s) => s.label);
    const picked = newbornSignsFor(["ดูดนมน้อยลง", "ผื่น"]);
    expect(picked.length).toBe(2); // ตัวร้อน + ดูดนม · ผื่นไม่มีในหมวดนี้ จึงไม่ยกมา
    for (const p of picked) expect(labels).toContain(p);

    const t = newbornSignTable();
    expect(t.base).toHaveLength(1);
    for (const v of [...t.base, ...Object.values(t.bySymptom)]) expect(labels).toContain(v);
  });
});

// ---------- เตือนยาประจำของลูก ----------

describe("เวลาของยาประจำที่ต้องเตือน", () => {
  it("ถึงเวลาแล้วไม่เกินชั่วโมง และยังไม่มีใครให้", () => {
    expect(dueSlots("09:00,21:00", [], "2026-11-22T09:05:00")).toEqual(["09:00"]);
    expect(dueSlots("09:00,21:00", [], "2026-11-22T08:55:00")).toEqual([]);
    expect(dueSlots("09:00", [], "2026-11-22T10:30:00")).toEqual([]);
  });
  it("มีคนให้ไปแล้ว (แม้ก่อนเวลานิดหน่อย) ไม่เตือน", () => {
    expect(dueSlots("09:00", ["2026-11-22T08:40:00"], "2026-11-22T09:05:00")).toEqual([]);
    expect(dueSlots("21:00", ["2026-11-22T09:00:00"], "2026-11-22T21:05:00")).toEqual(["21:00"]);
  });
});

const cronEnv = (): CronEnv =>
  ({ DB: env.DB, VAPID_PUBLIC_KEY: "pub", VAPID_PRIVATE_KEY: "priv" }) as CronEnv;
/** 22 พ.ย. 2569 09:05 เวลาไทย = 02:05 UTC */
const NOW = Date.UTC(2026, 10, 22, 2, 5, 0);

describe("cron เตือนยาประจำของลูก", () => {
  beforeEach(async () => {
    for (const t of ["child_med_sent", "child_med_doses", "child_meds", "children", "push_subscriptions", "family_members", "families", "user"]) {
      await env.DB.prepare(`DELETE FROM ${t}`).run();
    }
    await env.DB.prepare(
      `INSERT INTO user (id, name, email, email_verified, created_at, updated_at)
       VALUES ('u1','แม่','m@t.dev',0,0,0), ('u2','พ่อ','d@t.dev',0,0,0), ('u3','ยาย','g@t.dev',0,0,0)`,
    ).run();
    await env.DB.prepare("INSERT INTO families (id, name, owner_id) VALUES ('f1','บ้าน','u1')").run();
    await env.DB.prepare(
      `INSERT INTO family_members (id, family_id, user_id, role, status) VALUES
       ('m1','f1','u1','owner','active'), ('m2','f1','u2','editor','active'), ('m3','f1','u3','viewer','active')`,
    ).run();
    await env.DB.prepare(
      "INSERT INTO children (id, family_id, name, birth_date, created_by) VALUES ('c1','f1','ต้องตา','2026-11-02','u1')",
    ).run();
    await env.DB.prepare(
      `INSERT INTO child_meds (id, family_id, child_id, name, mode, times, created_by)
       VALUES ('k1','f1','c1','วิตามินดี','daily','09:00','u1')`,
    ).run();
    await env.DB.prepare(
      `INSERT INTO push_subscriptions (id, user_id, endpoint) VALUES
       ('s1','u1','https://push.test/1'), ('s2','u2','https://push.test/2'), ('s3','u3','https://push.test/3')`,
    ).run();
  });

  it("เตือนคนที่บันทึกได้ทั้งบ้าน ไม่ปลุก viewer และไม่เตือนซ้ำรอบถัดไป", async () => {
    const hit: string[] = [];
    const send = async (o: { endpoint: string }) => {
      hit.push(o.endpoint);
      return { ok: true } as const;
    };
    expect(await runChildMedReminders(cronEnv(), { now: NOW, send })).toMatchObject({ due: 1, sent: 2 });
    expect(hit.sort()).toEqual(["https://push.test/1", "https://push.test/2"]);
    expect(await runChildMedReminders(cronEnv(), { now: NOW + 300_000, send })).toMatchObject({ due: 0 });
  });

  it("มีคนให้แล้ว ไม่เตือนใคร", async () => {
    await env.DB.prepare(
      "INSERT INTO child_med_doses (id, family_id, med_id, given_at, given_by) VALUES ('d1','f1','k1','2026-11-22T08:50:00','u2')",
    ).run();
    expect(await runChildMedReminders(cronEnv(), { now: NOW, send: async () => ({ ok: true }) })).toMatchObject({ due: 0 });
  });
});
