/**
 * ตัวจับเวลาเตือนบันทึกลูก — "ผ่านไป X ชม. นับจากครั้งล่าสุด"
 *
 * ต่างจากนัดกับยาตรงที่ไม่มีเวลาตายตัวเลย เวลาเตือนคิดใหม่ทุกรอบจากบันทึกล่าสุด
 * กติกาทั้งหมดอยู่ใน src/lib/baby-reminder.ts ตัวเดียวกับที่หน้าจอใช้บอก "อีก 35 นาที"
 * ไฟล์นี้แค่ดึงของจาก D1 มาให้ แล้วยิงตามที่กติกาตัดสิน
 *
 * ⚠️ ยิงเข้าเครื่องของ "คนตั้ง" เท่านั้น ไม่ใช่ทั้งครอบครัว — ตีสามจะได้ไม่ปลุกทั้งบ้าน
 */
import { sendPush, type PushResult } from "../../src/lib/push";
import { localNowIso } from "../../src/lib/local-time";
import { REMIND_LATE_MIN, cronDecision, reminderState } from "../../src/lib/baby-reminder";
import type { CronEnv } from "./reminders";

interface ReminderRow {
  id: string;
  family_id: string;
  user_id: string;
  child_id: string | null;
  kind: string;
  every_min: number;
  quiet_from: string | null;
  quiet_to: string | null;
  last_anchor: string | null;
}

/**
 * ตัวที่เปิดอยู่ ของคนที่ยังเป็นสมาชิกของครอบครัวนั้น
 * ออกจากครอบครัวแล้ว = ไม่ควรได้รู้ว่าลูกบ้านนั้นกินเมื่อไหร่อีก
 */
async function activeReminders(db: D1Database): Promise<ReminderRow[]> {
  const { results } = await db
    .prepare(
      `SELECT r.id, r.family_id, r.user_id, r.child_id, r.kind, r.every_min,
              r.quiet_from, r.quiet_to, r.last_anchor
         FROM baby_reminders r
         JOIN family_members m
           ON m.family_id = r.family_id AND m.user_id = r.user_id AND m.status = 'active'
        WHERE r.active = 1
        LIMIT 500`,
    )
    .all<ReminderRow>();
  return results ?? [];
}

/**
 * บันทึกล่าสุดของประเภทนั้น — รอบที่ยังจับเวลาอยู่มาก่อนเสมอ
 * (ใส่ย้อนหลังที่ใหม่กว่าไม่ได้แปลว่าเลิกให้นมแล้ว)
 */
async function latestLog(db: D1Database, r: ReminderRow) {
  return db
    .prepare(
      `SELECT kind, started_at AS startedAt, ended_at AS endedAt
         FROM baby_logs
        WHERE family_id = ?1 AND kind = ?2
          AND (CASE WHEN ?3 IS NULL THEN child_id IS NULL ELSE child_id = ?3 END)
        ORDER BY (ended_at IS NULL) DESC, started_at DESC
        LIMIT 1`,
    )
    .bind(r.family_id, r.kind, r.child_id)
    .first<{ kind: "breast"; startedAt: string; endedAt: string | null }>();
}

export interface BabyRunResult {
  due: number;
  sent: number;
  skippedLate: number;
  removed: number;
  skipped?: "no-key";
}

export async function runBabyReminders(
  env: CronEnv,
  opts: { now?: number; send?: typeof sendPush } = {},
): Promise<BabyRunResult> {
  const now = opts.now ?? Date.now();
  const send = opts.send ?? sendPush;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) {
    return { due: 0, sent: 0, skippedLate: 0, removed: 0, skipped: "no-key" };
  }

  const nowLocal = localNowIso(now);
  const sentAt = new Date(now).toISOString();
  let due = 0;
  let sent = 0;
  let skippedLate = 0;
  let removed = 0;

  for (const r of await activeReminders(env.DB)) {
    const state = reminderState(true, await latestLog(env.DB, r), {
      everyMin: r.every_min,
      quietFrom: r.quiet_from,
      quietTo: r.quiet_to,
    });
    const decision = cronDecision(state, r.last_anchor, nowLocal);
    if (decision === "wait" || state.status !== "due") continue;

    if (decision === "skip") {
      skippedLate++;
      await env.DB.prepare("UPDATE baby_reminders SET last_anchor = ?1 WHERE id = ?2")
        .bind(state.anchor, r.id)
        .run();
      continue;
    }

    due++;
    /**
     * จดก่อนยิง — last_sent_at คือสิ่งที่ /api/push/next ใช้ตอบว่า push ใบนี้เรื่องอะไร
     * ถ้ายิงก่อนจด service worker อาจถามมาถึงก่อนแล้วได้ข้อความผิดเรื่อง
     */
    await env.DB.prepare("UPDATE baby_reminders SET last_anchor = ?1, last_sent_at = ?2 WHERE id = ?3")
      .bind(state.anchor, sentAt, r.id)
      .run();

    const { results: devices } = await env.DB.prepare(
      "SELECT id, endpoint FROM push_subscriptions WHERE user_id = ?1",
    )
      .bind(r.user_id)
      .all<{ id: string; endpoint: string }>();

    for (const device of devices ?? []) {
      let res: PushResult;
      try {
        res = await send({
          endpoint: device.endpoint,
          publicKey: env.VAPID_PUBLIC_KEY,
          privateKey: env.VAPID_PRIVATE_KEY,
          subject: env.VAPID_SUBJECT ?? "mailto:support@precare.app",
          // ค้างนานกว่านี้ไม่มีประโยชน์ — มีบันทึกใหม่ไปแล้วก็ได้
          ttlSeconds: REMIND_LATE_MIN * 60,
        });
      } catch {
        continue;
      }
      if (res.ok) {
        sent++;
        await env.DB.prepare("UPDATE push_subscriptions SET last_success_at = ?1 WHERE id = ?2")
          .bind(sentAt, device.id)
          .run();
      } else if (res.gone) {
        await env.DB.prepare("DELETE FROM push_subscriptions WHERE id = ?1").bind(device.id).run();
        removed++;
      }
    }
  }

  return { due, sent, skippedLate, removed };
}
