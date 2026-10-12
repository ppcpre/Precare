import { and, asc, eq, gte, isNull, lte, or, sql } from "drizzle-orm";
import { getDb } from "@/db";
import {
  appointments,
  familyMembers,
  medicationDoses,
  medicationTimes,
  medications,
  user as userTable,
} from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { thaiDate, timeOf } from "@/lib/format";
import { localNowIso } from "@/lib/local-time";

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
