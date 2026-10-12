/**
 * ตัวจับเวลาเตือนกินยา — แยกไฟล์จากเตือนนัด เพราะกติกาคนละแบบ
 *
 * นัดหมายเกิดครั้งเดียว ส่วนยาเกิดซ้ำทุกวันตามเวลาที่ตั้งไว้ จึงไม่มีแถว
 * "ครั้งที่จะเตือน" รออยู่ล่วงหน้า ต้องคิดจากเวลาของวันนี้เอาเอง
 *
 * ไม่สร้างแถว dose ล่วงหน้าทั้งปี — ยาที่ไม่มีวันจบจะกลายเป็นแถวไม่รู้จบ
 * แถวจะเกิดตอนถูกเตือนหรือตอนผู้ใช้กดว่ากินแล้วเท่านั้น
 */
import { sendPush, type PushResult } from "../../src/lib/push";
import { localNowIso } from "../../src/lib/local-time";
import type { CronEnv } from "./reminders";

export interface DueDose {
  time_id: string;
  medication_id: string;
  user_id: string;
  at: string;
}

/**
 * ยาที่ถึงเวลาแล้วของวันนี้และยังไม่ได้เตือน
 *
 * `late_cutoff` กันการเตือนย้อนหลังข้ามวัน: ถ้าแอปหยุดไปสองวันแล้วกลับมา
 * ไม่ควรยิงเตือนยาของเมื่อวานซึ่งหมดความหมายไปแล้ว แต่ยังต้องเผื่อให้
 * cron ที่รันทุก 5 นาทีพลาดรอบได้บ้าง
 */
export const LATE_MINUTES = 60;

export async function dueDoses(
  db: D1Database,
  day: string,
  nowHm: string,
  cutoffHm: string,
): Promise<DueDose[]> {
  const { results } = await db
    .prepare(
      `SELECT t.id AS time_id, m.id AS medication_id, m.user_id, t.at
         FROM medication_times t
         JOIN medications m ON m.id = t.medication_id
         LEFT JOIN medication_doses d
                ON d.medication_time_id = t.id AND d.due_on = ?1
        WHERE m.active = 1
          AND m.start_on <= ?1
          AND (m.end_on IS NULL OR m.end_on >= ?1)
          AND t.at <= ?2
          AND t.at >= ?3
          AND d.sent_at IS NULL
          AND d.taken_at IS NULL
        ORDER BY t.at
        LIMIT 100`,
    )
    .bind(day, nowHm, cutoffHm)
    .all<DueDose>();
  return results ?? [];
}

/** เครื่องของเจ้าของยาเท่านั้น — ยาเป็นของคนคนเดียว ไม่ใช่ของครอบครัว */
async function devicesOf(db: D1Database, userId: string) {
  const { results } = await db
    .prepare("SELECT id, endpoint FROM push_subscriptions WHERE user_id = ?1")
    .bind(userId)
    .all<{ id: string; endpoint: string }>();
  return results ?? [];
}

export interface MedRunResult {
  due: number;
  sent: number;
  removed: number;
  skipped?: "no-key";
}

export async function runMedicationReminders(
  env: CronEnv,
  opts: { now?: number; send?: typeof sendPush } = {},
): Promise<MedRunResult> {
  const now = opts.now ?? Date.now();
  const send = opts.send ?? sendPush;

  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { due: 0, sent: 0, removed: 0, skipped: "no-key" };
  }

  const nowLocal = localNowIso(now);
  const day = nowLocal.slice(0, 10);
  const nowHm = nowLocal.slice(11, 16);
  const cutoff = new Date(now - LATE_MINUTES * 60_000);
  const cutoffLocal = localNowIso(cutoff.getTime());
  // ข้ามเที่ยงคืนแล้วเวลาย้อนหลังจะกลายเป็นของเมื่อวาน — ตัดที่ 00:00 ของวันนี้แทน
  const cutoffHm = cutoffLocal.slice(0, 10) === day ? cutoffLocal.slice(11, 16) : "00:00";

  const rows = await dueDoses(env.DB, day, nowHm, cutoffHm);
  let sent = 0;
  let removed = 0;

  for (const row of rows) {
    for (const device of await devicesOf(env.DB, row.user_id)) {
      let res: PushResult;
      try {
        res = await send({
          endpoint: device.endpoint,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT ?? "mailto:support@precare.app",
          /**
           * อยู่ได้ไม่เกินช่วงที่ยังมีความหมาย — เตือนกินยาตอนดึกของมื้อเช้า
           * ไม่ช่วยอะไร มีแต่ปลุกคนตื่น
           */
          ttlSeconds: LATE_MINUTES * 60,
        });
      } catch {
        continue;
      }

      if (res.ok) {
        sent++;
        await env.DB.prepare("UPDATE push_subscriptions SET last_success_at = ?1 WHERE id = ?2")
          .bind(new Date(now).toISOString(), device.id)
          .run();
      } else if (res.gone) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?1")
          .bind(device.id)
          .run();
        removed++;
      }
    }

    /**
     * ทำเครื่องหมายว่าเตือนแล้วเสมอ แม้ไม่มีเครื่องไหนรับ
     * ไม่งั้นแถวนี้จะถูกหยิบใหม่ทุก 5 นาทีจนพ้นช่วง late
     */
    await env.DB.prepare(
      `INSERT INTO medication_doses (id, medication_time_id, due_on, sent_at)
       VALUES (?1, ?2, ?3, ?4)
       ON CONFLICT (medication_time_id, due_on) DO UPDATE SET sent_at = ?4`,
    )
      .bind(crypto.randomUUID(), row.time_id, day, new Date(now).toISOString())
      .run();
  }

  return { due: rows.length, sent, removed };
}
