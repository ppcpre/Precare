/**
 * ตัวจับเวลาเตือนยาประจำของลูก
 *
 * ต่างจากยาของผู้ใหญ่ (เตือนเจ้าของคนเดียว) — ยาลูกเป็นของทั้งบ้าน ใครก็ให้ได้
 * จึงเตือนทุกคนในบ้านที่บันทึกได้ (owner/editor) ส่วน viewer บันทึกไม่ได้จึงไม่ปลุก
 * มีคนบันทึกว่าให้แล้วในช่วงนั้น = ไม่เตือนเลย (กติกาอยู่ใน src/lib/child-meds.ts)
 *
 * ยาตามอาการไม่มีเวลาตายตัว จึงไม่เตือน
 */
import { sendPush, type PushResult } from "../../src/lib/push";
import { localNowIso } from "../../src/lib/local-time";
import { CHILD_MED_LATE_MIN, dueSlots } from "../../src/lib/child-meds";
import type { CronEnv } from "./reminders";

interface MedRow {
  id: string;
  family_id: string;
  times: string | null;
}

export interface ChildMedRunResult {
  due: number;
  sent: number;
  removed: number;
  skipped?: "no-key";
}

export async function runChildMedReminders(
  env: CronEnv,
  opts: { now?: number; send?: typeof sendPush } = {},
): Promise<ChildMedRunResult> {
  const now = opts.now ?? Date.now();
  const send = opts.send ?? sendPush;
  if (!env.VAPID_PUBLIC_KEY || !env.VAPID_PRIVATE_KEY) return { due: 0, sent: 0, removed: 0, skipped: "no-key" };

  const nowLocal = localNowIso(now);
  const day = nowLocal.slice(0, 10);
  const sentAt = new Date(now).toISOString();
  let due = 0;
  let sent = 0;
  let removed = 0;

  const { results: meds } = await env.DB.prepare(
    "SELECT id, family_id, times FROM child_meds WHERE active = 1 AND mode = 'daily' LIMIT 500",
  ).all<MedRow>();

  for (const med of meds ?? []) {
    // ให้ไปแล้วตั้งแต่เมื่อไหร่ — ย้อนพอสำหรับช่วงก่อนเวลาของรอบที่เช้าสุดของวัน
    const { results: given } = await env.DB.prepare(
      "SELECT given_at FROM child_med_doses WHERE med_id = ?1 AND given_at >= ?2",
    )
      .bind(med.id, `${day}T00:00:00`)
      .all<{ given_at: string }>();
    const slots = dueSlots(
      med.times,
      (given ?? []).map((g) => g.given_at),
      nowLocal,
    );

    for (const at of slots) {
      // จองแถวก่อนยิง — ชน unique = รอบก่อนยิงไปแล้ว ข้าม
      const claim = await env.DB.prepare(
        `INSERT INTO child_med_sent (id, med_id, due_on, at, sent_at) VALUES (?1, ?2, ?3, ?4, ?5)
         ON CONFLICT (med_id, due_on, at) DO NOTHING`,
      )
        .bind(crypto.randomUUID(), med.id, day, at, sentAt)
        .run();
      if (!claim.meta.changes) continue;
      due++;

      const { results: devices } = await env.DB.prepare(
        `SELECT s.id, s.endpoint FROM push_subscriptions s
           JOIN family_members m ON m.user_id = s.user_id
          WHERE m.family_id = ?1 AND m.status = 'active' AND m.role IN ('owner','editor')`,
      )
        .bind(med.family_id)
        .all<{ id: string; endpoint: string }>();

      for (const device of devices ?? []) {
        let res: PushResult;
        try {
          res = await send({
            endpoint: device.endpoint,
            publicKey: env.VAPID_PUBLIC_KEY,
            privateKey: env.VAPID_PRIVATE_KEY,
            subject: env.VAPID_SUBJECT ?? "mailto:support@precare.app",
            ttlSeconds: CHILD_MED_LATE_MIN * 60,
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
  }
  return { due, sent, removed };
}
