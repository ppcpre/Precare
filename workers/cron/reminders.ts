/**
 * ตัวจับเวลาเตือนนัด — ใจความอยู่ในไฟล์นี้ ส่วน index.ts เป็นแค่ขาเข้า
 *
 * แยกออกมาเพื่อให้เทสต์เรียกได้ตรงๆ พร้อม D1 ของจริงและตัวส่ง push ปลอม
 * ถ้าเขียนรวมใน scheduled() จะทดสอบได้แค่ "ไม่ระเบิด" ซึ่งไม่พอสำหรับ
 * ของที่ยิงไปหาเครื่องผู้ใช้จริงและผิดแล้วน่ารำคาญมาก
 */
import { sendPush, type PushResult } from "../../src/lib/push";

export interface CronEnv {
  DB: D1Database;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

/** นัดที่จะเตือนต้องอยู่ในอีกไม่เกินเท่านี้ — เพดานของ reminderMinutesBefore คือ 7 วัน */
const HORIZON_DAYS = 8;

/**
 * เวลา "ตอนนี้" ในแบบเดียวกับที่ appt_datetime เก็บไว้
 *
 * นัดหมายเก็บเป็นเวลาที่โรงพยาบาลแบบไม่มี timezone (ดู components/appointments/form.tsx)
 * ส่วน worker วิ่งด้วยเวลา UTC เสมอ ถ้าเทียบตรงๆ จะเพี้ยนไป 7 ชั่วโมง
 * คือเตือนเช้าเกินไปครึ่งวัน ซึ่งแย่กว่าไม่เตือนเลย
 */
export const BANGKOK_OFFSET_MS = 7 * 60 * 60 * 1000;
export const bangkokNow = (now: number) =>
  new Date(now + BANGKOK_OFFSET_MS).toISOString().slice(0, 19);

export interface DueRow {
  id: string;
  family_id: string;
  appt_datetime: string;
}

/**
 * นัดที่ถึงเวลาต้องเตือนแล้ว
 *
 * สองเงื่อนไขแรกเทียบคอลัมน์ตรงๆ ไม่ครอบ datetime() เพื่อให้ใช้ index ได้
 * (ครอบเมื่อไหร่ SQLite ใช้ index ช่วงไม่ได้ ต้องไล่ทั้ง index) — เทียบเป็น
 * สตริงถูกต้องอยู่แล้วเพราะทุกแถวเก็บรูปแบบเดียวกันคือ YYYY-MM-DDTHH:MM:SS
 *
 * ส่วนเงื่อนไขที่สามต้องลบนาทีจึงเลี่ยง datetime() ไม่ได้ และต้องครอบ ?1 ด้วย
 * เพราะ datetime() คืนค่าแบบมีช่องว่างคั่น ("2026-09-25 09:30:00") ส่วนที่เก็บมี T คั่น
 * เทียบข้ามแบบกันแล้วผลผิดเงียบๆ (ช่องว่างมาก่อน T ในการเรียงตัวอักษร)
 */
export async function dueAppointments(db: D1Database, nowLocal: string): Promise<DueRow[]> {
  const horizon = new Date(new Date(`${nowLocal}Z`).getTime() + HORIZON_DAYS * 86400_000)
    .toISOString()
    .slice(0, 19);

  const { results } = await db
    .prepare(
      `SELECT id, family_id, appt_datetime
         FROM appointments
        WHERE reminder_enabled = 1
          AND reminder_sent_at IS NULL
          AND appt_datetime > ?1
          AND appt_datetime <= ?2
          AND datetime(appt_datetime, '-' || reminder_minutes_before || ' minutes') <= datetime(?1)
        ORDER BY appt_datetime
        LIMIT 100`,
    )
    .bind(nowLocal, horizon)
    .all<DueRow>();
  return results ?? [];
}

/** ทุกคนในครอบครัวที่เปิดแจ้งเตือนไว้ — นัดเป็นของครอบครัว ไม่ใช่ของคนสร้าง */
async function subscribersOf(db: D1Database, familyId: string) {
  const { results } = await db
    .prepare(
      `SELECT s.id, s.endpoint
         FROM push_subscriptions s
         JOIN family_members m ON m.user_id = s.user_id
        WHERE m.family_id = ?1 AND m.status = 'active'`,
    )
    .bind(familyId)
    .all<{ id: string; endpoint: string }>();
  return results ?? [];
}

export interface RunResult {
  due: number;
  sent: number;
  removed: number;
  skipped?: "no-key";
}

export async function runReminders(
  env: CronEnv,
  opts: { now?: number; send?: typeof sendPush } = {},
): Promise<RunResult> {
  const now = opts.now ?? Date.now();
  const send = opts.send ?? sendPush;

  // ยังไม่ได้ตั้ง secret — ออกไปเงียบๆ ไม่ใช่โยน error ทุก 5 นาที
  // และห้ามทำเครื่องหมายว่าเตือนแล้ว ไม่งั้นนัดนั้นจะไม่มีวันถูกเตือน
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { due: 0, sent: 0, removed: 0, skipped: "no-key" };
  }

  const rows = await dueAppointments(env.DB, bangkokNow(now));
  let sent = 0;
  let removed = 0;

  for (const row of rows) {
    const subs = await subscribersOf(env.DB, row.family_id);

    for (const sub of subs) {
      let res: PushResult;
      try {
        res = await send({
          endpoint: sub.endpoint,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT ?? "mailto:support@precare.app",
          // อยู่ได้ถึงเวลานัดก็พอ เตือนหลังจากนั้นไม่มีประโยชน์แล้ว
          ttlSeconds: 3600,
        });
      } catch {
        // เซิร์ฟเวอร์ push ล่มชั่วคราว — ข้ามไป รอบหน้าค่อยว่ากัน
        continue;
      }

      if (res.ok) {
        sent++;
        await env.DB.prepare("UPDATE push_subscriptions SET last_success_at = ?1 WHERE id = ?2")
          .bind(new Date(now).toISOString(), sub.id)
          .run();
      } else if (res.gone) {
        // ถอนการติดตั้งหรือล้างข้อมูลเบราว์เซอร์ไปแล้ว ไม่ลบทิ้งก็ยิงใส่ที่ตายแล้วตลอดไป
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(sub.id).run();
        removed++;
      }
    }

    /**
     * ทำเครื่องหมายว่าเตือนแล้วเสมอ แม้ไม่มีใครเปิดแจ้งเตือนไว้เลย
     *
     * ถ้าไม่ทำ นัดนั้นจะถูกหยิบขึ้นมาใหม่ทุก 5 นาทีจนถึงเวลานัด
     * กินโควตา D1 ฟรีไปเรื่อยๆ โดยไม่ได้อะไรเลย
     */
    await env.DB.prepare("UPDATE appointments SET reminder_sent_at = ?1 WHERE id = ?2")
      .bind(new Date(now).toISOString(), row.id)
      .run();
  }

  return { due: rows.length, sent, removed };
}
