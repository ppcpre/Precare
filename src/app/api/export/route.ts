import { and, eq, isNull } from "drizzle-orm";
import { getDb } from "@/db";
import { consents, familyMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import {
  getFamily,
  getPregnancy,
  listAppointments,
  listKickSessions,
  listLaborSessions,
  listPhotos,
  listVisitQuestions,
  listWeeklyLogs,
} from "@/lib/queries";

/**
 * ส่งออกข้อมูลของผู้ใช้เป็นไฟล์ JSON — สิทธิ์ตาม PDPA
 *
 * เป็น route handler ไม่ใช่ Server Action เพราะปลายทางคือ "ไฟล์ที่ดาวน์โหลดได้"
 * ไม่ใช่ค่าที่เอาไปแสดงบนหน้าจอ
 *
 * ขอบเขตที่ต้องบอกให้ชัด: ไฟล์นี้มี **ข้อมูลและรายการไฟล์** ไม่ได้รวมตัวรูป
 * และวิดีโอ เพราะการยัดไฟล์หลายร้อยเมกะไบต์ลงในคำขอเดียวทำให้ worker
 * ที่มีเพดานหน่วยความจำ 128 MB ล้ม รูปโหลดได้จากอัลบั้มทีละใบ
 * — เขียนกำกับไว้ในไฟล์เองด้วย ไม่ใช่ให้ผู้ใช้มาเดา
 */
export async function GET() {
  const me = await getSessionUser();
  if (!me) return Response.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const db = await getDb();

  const memberships = await db
    .select({ familyId: familyMembers.familyId, role: familyMembers.role })
    .from(familyMembers)
    .where(and(eq(familyMembers.userId, me.id), eq(familyMembers.status, "active")));

  const families = [];
  for (const m of memberships) {
    const [fam, profile, logs, appts, photos, kicks, labor, questions] = await Promise.all([
      getFamily(db, m.familyId),
      getPregnancy(db, m.familyId),
      listWeeklyLogs(db, m.familyId),
      listAppointments(db, m.familyId),
      listPhotos(db, m.familyId),
      listKickSessions(db, m.familyId, 1000),
      listLaborSessions(db, m.familyId, 1000),
      listVisitQuestions(db, m.familyId),
    ]);
    families.push({
      name: fam?.name ?? null,
      yourRole: m.role,
      pregnancy: profile,
      healthLogs: logs,
      appointments: appts,
      // เก็บ metadata ของไฟล์ ไม่ใช่ตัวไฟล์ — ดูเหตุผลด้านบน
      media: photos,
      kickSessions: kicks,
      contractionSessions: labor,
      visitQuestions: questions,
    });
  }

  const consentRows = await db
    .select({
      kind: consents.kind,
      version: consents.version,
      grantedAt: consents.grantedAt,
    })
    .from(consents)
    .where(and(eq(consents.userId, me.id), isNull(consents.revokedAt)));

  const body = {
    exportedAt: new Date().toISOString(),
    note: "ไฟล์นี้มีข้อมูลและรายการไฟล์ แต่ไม่ได้รวมตัวรูปและวิดีโอ ดาวน์โหลดรูปได้จากหน้าอัลบั้ม",
    account: { name: me.name, email: me.email },
    consents: consentRows,
    families,
  };

  return new Response(JSON.stringify(body, null, 2), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      // ให้เบราว์เซอร์ดาวน์โหลดเป็นไฟล์ ไม่ใช่เปิดอ่านในแท็บ
      "content-disposition": `attachment; filename="precare-export-${new Date().toISOString().slice(0, 10)}.json"`,
      "cache-control": "no-store",
    },
  });
}
