import { and, asc, desc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  babyReminders,
  children,
  familyMembers,
  medicationDoses,
  medicationTimes,
  medications,
  user as userTable,
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { thaiDate, timeOf } from "@/lib/format";
import { localNowIso } from "@/lib/local-time";
import { REMIND_TITLE, hoursLabel } from "@/lib/baby-reminder";

/**
 * บอก service worker ว่าจะเตือนเรื่องอะไร
 *
 * push ที่ส่งไปไม่มีเนื้อหา (ดูเหตุผลใน src/lib/push.ts) — service worker
 * จึงมาถามที่นี่พร้อม cookie ของผู้ใช้ ข้อมูลสุขภาพจึงไม่เคยผ่านเซิร์ฟเวอร์
 * push ของ Google หรือ Apple เลย
 *
 * ตอบเท่าที่จำเป็นต่อการแสดงการแจ้งเตือน ไม่ใช่ข้อมูลนัดทั้งก้อน
 *
 * ตอบได้สองเรื่อง: ยาที่ถึงเวลาแล้วของวันนี้ (มาก่อน เพราะหมดอายุเร็วกว่า)
 * และนัดหมายครั้งถัดไป — push ที่ส่งมาไม่ได้บอกว่าเป็นเรื่องไหน
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const db = await getDb();
  const nowLocal = localNowIso();
  const today = nowLocal.slice(0, 10);
  const nowHm = nowLocal.slice(11, 16);

  /**
   * เตือนบันทึกลูกที่ cron เพิ่งยิงให้คนนี้ — มาก่อนทุกเรื่อง
   *
   * cron จด last_sent_at ก่อนยิง push จึงรู้ได้ว่า push ใบที่เพิ่งมาถึงคือเรื่องนี้
   * 10 นาทีพอสำหรับเครื่องที่ตื่นช้า แต่ไม่นานจนไปทับ push เรื่องอื่นที่ตามมา
   * กรองด้วยครอบครัวที่ยังเป็นสมาชิกอยู่ ไม่ใช่แค่ user_id
   */
  const recent = new Date(Date.now() - 10 * 60_000).toISOString();
  const baby = await db
    .select({
      kind: babyReminders.kind,
      everyMin: babyReminders.everyMin,
      childId: babyReminders.childId,
      childName: children.name,
    })
    .from(babyReminders)
    .innerJoin(
      familyMembers,
      and(
        eq(familyMembers.familyId, babyReminders.familyId),
        eq(familyMembers.userId, me.id),
        eq(familyMembers.status, "active"),
      ),
    )
    .leftJoin(children, eq(children.id, babyReminders.childId))
    .where(and(eq(babyReminders.userId, me.id), gte(babyReminders.lastSentAt, recent)))
    .orderBy(desc(babyReminders.lastSentAt))
    .limit(1)
    .get();

  if (baby) {
    return Response.json(
      {
        title: `ถึงเวลา${REMIND_TITLE[baby.kind]}`,
        body: `ผ่านไป ${hoursLabel(baby.everyMin)} แล้วนับจากครั้งล่าสุด${baby.childName ? ` · ${baby.childName}` : ""}`,
        url: baby.childId ? `/baby/${baby.childId}/log` : "/baby/pump",
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  /**
   * ยาที่ถึงเวลาแล้ววันนี้และยังไม่ได้ติ๊กว่ากิน — ตอบก่อนนัดหมาย
   *
   * ของสองอย่างนี้มาจาก push คนละใบแต่ service worker ถามที่เดียวกัน
   * ยามีอายุสั้นกว่า (เตือนกินยาตอนดึกไม่มีประโยชน์) จึงให้มาก่อน
   */
  const med = await db
    .select({ name: medications.name, dose: medications.dose, at: medicationTimes.at })
    .from(medicationTimes)
    .innerJoin(medications, eq(medications.id, medicationTimes.medicationId))
    .leftJoin(
      medicationDoses,
      and(
        eq(medicationDoses.medicationTimeId, medicationTimes.id),
        eq(medicationDoses.dueOn, today),
      ),
    )
    .where(
      and(
        eq(medications.userId, me.id),
        eq(medications.active, true),
        lte(medications.startOn, today),
        or(isNull(medications.endOn), gte(medications.endOn, today)),
        lte(medicationTimes.at, nowHm),
        // เลยมานานเกินหนึ่งชั่วโมงถือว่าหมดความหมาย — ตรงกับ LATE_MINUTES ของ cron
        gte(medicationTimes.at, sql`time(${nowHm}, '-60 minutes')`),
        isNull(medicationDoses.takenAt),
      ),
    )
    .orderBy(asc(medicationTimes.at))
    .limit(1)
    .get();

  if (med) {
    return Response.json(
      {
        title: `ถึงเวลากิน${med.name}`,
        body: `${med.at} น.${med.dose ? ` · ${med.dose}` : ""}`,
        url: "/medications",
      },
      { headers: { "cache-control": "no-store" } },
    );
  }

  const row = await db
    .select({
      id: appointments.id,
      title: appointments.title,
      apptDatetime: appointments.apptDatetime,
      location: appointments.location,
    })
    .from(appointments)
    .innerJoin(
      familyMembers,
      and(
        eq(familyMembers.familyId, appointments.familyId),
        eq(familyMembers.userId, me.id),
        eq(familyMembers.status, "active"),
      ),
    )
    .innerJoin(userTable, eq(userTable.id, me.id))
    // เฉพาะครอบครัวที่กำลังเปิดใช้อยู่ ไม่ใช่ทุกครอบครัวที่เคยเป็นสมาชิก
    .where(
      and(
        eq(appointments.familyId, userTable.activeFamilyId),
        // เวลาไทย ไม่ใช่ UTC — ไม่งั้นแจ้งเตือนนัดที่ผ่านไปแล้ว
        gte(appointments.apptDatetime, localNowIso()),
      ),
    )
    .orderBy(asc(appointments.apptDatetime))
    .limit(1)
    .get();

  if (!row) return Response.json({}, { headers: { "cache-control": "no-store" } });

  return Response.json(
    {
      title: row.title ? `นัดหมาย: ${row.title}` : "นัดหมายใกล้ถึงแล้ว",
      body: `${thaiDate(row.apptDatetime)} ${timeOf(row.apptDatetime)}${row.location ? ` · ${row.location}` : ""}`,
      url: "/appointments",
    },
    { headers: { "cache-control": "no-store" } },
  );
}
