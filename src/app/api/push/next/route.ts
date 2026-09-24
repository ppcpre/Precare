import { and, asc, eq, gte } from "drizzle-orm";
import { getDb } from "@/db";
import { appointments, familyMembers, user as userTable } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { thaiDate, timeOf } from "@/lib/format";

/**
 * บอก service worker ว่าจะเตือนเรื่องอะไร
 *
 * push ที่ส่งไปไม่มีเนื้อหา (ดูเหตุผลใน src/lib/push.ts) — service worker
 * จึงมาถามที่นี่พร้อม cookie ของผู้ใช้ ข้อมูลสุขภาพจึงไม่เคยผ่านเซิร์ฟเวอร์
 * push ของ Google หรือ Apple เลย
 *
 * ตอบเท่าที่จำเป็นต่อการแสดงการแจ้งเตือน ไม่ใช่ข้อมูลนัดทั้งก้อน
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const db = await getDb();
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
        gte(appointments.apptDatetime, new Date().toISOString()),
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
