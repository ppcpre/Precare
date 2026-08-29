/**
 * ฝั่งอ่าน — เรียกจาก React Server Component ตรงๆ ไม่ต้องมี REST endpoint
 *
 * ⚠️ ทุกฟังก์ชันในนี้ต้องรับ familyId ที่ผ่าน requireRole มาแล้วเท่านั้น
 *    ห้ามรับ familyId ดิบจาก searchParams หรือ props ของ client
 */
import { and, asc, desc, eq, gte, isNotNull, isNull, lt, sql } from "drizzle-orm";
import type { Db } from "@/db";
import { getDb } from "@/db";
import { getSessionUser } from "@/lib/session";
import { requireRole } from "@/lib/authz";
import {
  appointments, careGroups, families, familyInvites, familyMembers,
  photos, pregnancyProfiles, trackingSessions, user, weeklyLogs,
} from "@/db/schema";
import { STALE_HOURS, toView, type SessionView } from "@/lib/kicks";
import type { CostItem } from "@/lib/costs";
import { parseSymptoms, type Role, type WeeklyLogView } from "@/types";
import { calculateGestationalAge, daysUntilDueDate } from "@/lib/pregnancy";

/**
 * ด่านเดียวที่ RSC ใช้เปิดหน้า — คืน db + user + familyId + role ที่ผ่าน authz แล้ว
 * ถ้าไม่ผ่านจะโยน AuthzError ไม่ใช่คืน null เพื่อกันเผลอ render ต่อ
 */
export async function requireFamilyContext(min: Role = "viewer") {
  const user = await getSessionUser();
  if (!user) throw new Error("UNAUTHENTICATED");
  const db = await getDb();
  const familyId = user.activeFamilyId;
  if (!familyId) throw new Error("NO_ACTIVE_FAMILY");
  const role = await requireRole(db, familyId, user.id, min);
  return { db, user, familyId, role };
}

export async function getPregnancy(db: Db, familyId: string) {
  const p = await db
    .select()
    .from(pregnancyProfiles)
    .where(eq(pregnancyProfiles.familyId, familyId))
    .get();
  if (!p?.lmpDate) return { profile: p ?? null, ga: null, daysLeft: null };
  return {
    profile: p,
    ga: calculateGestationalAge(p.lmpDate),
    daysLeft: p.dueDate ? daysUntilDueDate(p.dueDate) : null,
  };
}

export async function listWeeklyLogs(db: Db, familyId: string, limit = 50) {
  const rows = await db
    .select({ log: weeklyLogs, recorderName: user.name })
    .from(weeklyLogs)
    .innerJoin(user, eq(user.id, weeklyLogs.recordedBy))
    .where(eq(weeklyLogs.familyId, familyId))
    .orderBy(desc(weeklyLogs.logDate))
    .limit(limit);
  return rows.map((r) => ({
    ...r.log,
    symptoms: parseSymptoms(r.log.symptoms),
    recorderName: r.recorderName,
  }));
}

export async function getWeeklyLogById(db: Db, familyId: string, id: string): Promise<WeeklyLogView | null> {
  const r = await db
    .select()
    .from(weeklyLogs)
    .where(and(eq(weeklyLogs.id, id), eq(weeklyLogs.familyId, familyId)))
    .get();
  return r ? { ...r, symptoms: parseSymptoms(r.symptoms) } : null;
}

/** ค่าเริ่มต้นของฟอร์ม — สัปดาห์ที่คำนวณจาก LMP และน้ำหนักครั้งล่าสุดไว้โชว์ delta */
export async function getLogFormDefaults(db: Db, familyId: string) {
  const [profileRows, lastRows] = await db.batch([
    db.select().from(pregnancyProfiles).where(eq(pregnancyProfiles.familyId, familyId)),
    db
      .select({ weight: weeklyLogs.weight })
      .from(weeklyLogs)
      .where(eq(weeklyLogs.familyId, familyId))
      .orderBy(desc(weeklyLogs.logDate))
      .limit(1),
  ]);
  const lmp = profileRows[0]?.lmpDate ?? null;
  return {
    suggestedWeek: lmp ? calculateGestationalAge(lmp).weeks : null,
    lastWeight: lastRows[0]?.weight ?? null,
  };
}

export async function listAppointments(db: Db, familyId: string, when: "upcoming" | "past" = "upcoming") {
  // คืน now ออกไปด้วย เพื่อให้ component ไม่ต้องเรียก Date.now() เอง (react-hooks/purity)
  const now = Date.now();
  const nowIso = new Date(now).toISOString();
  const items = await db
    .select()
    .from(appointments)
    .where(
      and(
        eq(appointments.familyId, familyId),
        when === "upcoming"
          ? gte(appointments.apptDatetime, nowIso)
          : lt(appointments.apptDatetime, nowIso),
      ),
    )
    .orderBy(when === "upcoming" ? asc(appointments.apptDatetime) : desc(appointments.apptDatetime));
  return { items, now };
}


/**
 * นัดหมายทั้งหมดพร้อมค่าใช้จ่ายและกลุ่ม — ใช้กับหน้าค่าใช้จ่ายทุกมุมมอง
 *
 * ดึงทีเดียวทั้งชุดแล้วให้ฝั่ง src/lib/costs.ts จัดกลุ่มเอง แทนที่จะยิง
 * GROUP BY แยกต่อมุมมอง เพราะจำนวนนัดต่อครอบครัวอยู่ในหลักสิบ ไม่ใช่หลักหมื่น
 * และการคำนวณในหน่วยความจำทำให้สลับมุมมองได้โดยไม่ต้องแตะ D1 ซ้ำ
 *
 * leftJoin เพราะ group_id เป็น null ได้ (นัดที่ยังไม่เลือกกลุ่ม = ทั่วไป)
 */
export async function listAppointmentCosts(db: Db, familyId: string): Promise<CostItem[]> {
  return db
    .select({
      id: appointments.id,
      apptDatetime: appointments.apptDatetime,
      title: appointments.title,
      location: appointments.location,
      groupId: appointments.groupId,
      groupName: careGroups.name,
      groupColor: careGroups.color,
      costSatang: appointments.costSatang,
      claimStatus: appointments.claimStatus,
    })
    .from(appointments)
    .leftJoin(careGroups, eq(careGroups.id, appointments.groupId))
    .where(eq(appointments.familyId, familyId))
    .orderBy(desc(appointments.apptDatetime));
}

/** กลุ่มที่ยังใช้อยู่ เรียงตามเวลาสร้าง เพื่อให้ลำดับคงที่ทุกหน้า */
export async function listCareGroups(db: Db, familyId: string) {
  return db
    .select({ id: careGroups.id, name: careGroups.name, color: careGroups.color })
    .from(careGroups)
    .where(and(eq(careGroups.familyId, familyId), eq(careGroups.archived, false)))
    .orderBy(asc(careGroups.createdAt));
}


const KICK_COLS = {
  id: trackingSessions.id,
  startedAt: trackingSessions.startedAt,
  endedAt: trackingSessions.endedAt,
  targetCount: trackingSessions.targetCount,
  events: trackingSessions.events,
  note: trackingSessions.note,
};

/**
 * รอบที่ยังนับอยู่ (ถ้ามี)
 *
 * รอบที่ค้างเกิน STALE_HOURS ถือว่าลืมปิด ไม่ใช่รอบที่ยังใช้งานอยู่
 * ถ้าไม่กรองทิ้ง ผู้ใช้จะเปิดแอปมาเจอรอบเมื่อวานที่นับมา 14 ชั่วโมงแล้วสับสน
 * (ไม่ลบทิ้ง ยังอยู่ในประวัติ แค่ไม่เอามาแสดงเป็นรอบที่กำลังนับ)
 */
export async function getActiveKickSession(
  db: Db,
  familyId: string,
): Promise<SessionView | null> {
  const row = await db
    .select(KICK_COLS)
    .from(trackingSessions)
    .where(
      and(
        eq(trackingSessions.familyId, familyId),
        eq(trackingSessions.kind, "kick"),
        isNull(trackingSessions.endedAt),
      ),
    )
    .orderBy(desc(trackingSessions.startedAt))
    .get();
  if (!row) return null;

  const cutoff = Date.now() - STALE_HOURS * 3600_000;
  if (new Date(row.startedAt).getTime() < cutoff) return null;
  return toView(row);
}

/** ประวัติรอบที่จบแล้ว ใหม่ไปเก่า */
export async function listKickSessions(db: Db, familyId: string, limit = 30) {
  const rows = await db
    .select(KICK_COLS)
    .from(trackingSessions)
    .where(
      and(
        eq(trackingSessions.familyId, familyId),
        eq(trackingSessions.kind, "kick"),
        isNotNull(trackingSessions.endedAt),
      ),
    )
    .orderBy(desc(trackingSessions.startedAt))
    .limit(limit);
  return rows.map(toView);
}

export async function getAppointmentById(db: Db, familyId: string, id: string) {
  return db
    .select()
    .from(appointments)
    .where(and(eq(appointments.id, id), eq(appointments.familyId, familyId)))
    .get();
}

export async function listMembers(db: Db, familyId: string, meId: string) {
  const rows = await db
    .select({
      id: familyMembers.id,
      userId: familyMembers.userId,
      role: familyMembers.role,
      status: familyMembers.status,
      joinedAt: familyMembers.joinedAt,
      name: user.name,
      email: user.email,
      image: user.image,
    })
    .from(familyMembers)
    .innerJoin(user, eq(user.id, familyMembers.userId))
    .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.status, "active")))
    .orderBy(asc(familyMembers.joinedAt));
  return rows.map((r) => ({ ...r, isMe: r.userId === meId }));
}

/** คำเชิญที่ยังรอตอบรับ — owner เท่านั้นที่ควรเห็น เช็คสิทธิ์ที่หน้าเรียกใช้ */
export async function listPendingInvites(db: Db, familyId: string) {
  return db
    .select()
    .from(familyInvites)
    .where(and(eq(familyInvites.familyId, familyId), eq(familyInvites.status, "pending")))
    .orderBy(desc(familyInvites.createdAt));
}

/**
 * T3.7 — ข้อมูลหน้า Dashboard ในรอบเดียว
 *
 * ใช้ batch() ยิงพร้อมกันแทนการ await ทีละอัน — บนมือถือที่ latency สูง
 * การรอ 4 รอบต่อกันเห็นผลชัดกว่าที่คิด
 */
export async function getDashboard(db: Db, familyId: string) {
  // คืน now ออกไปด้วย เพื่อให้ component ไม่ต้องเรียก Date.now() เอง
  // (react-hooks/purity ห้ามเรียกฟังก์ชัน impure ใน render แม้จะเป็น server component)
  const now = Date.now();
  const nowIso = new Date(now).toISOString();

  const [pregnancyRows, apptRows, logRows, memberCount] = await db.batch([
    db.select().from(pregnancyProfiles).where(eq(pregnancyProfiles.familyId, familyId)),
    db
      .select()
      .from(appointments)
      .where(and(eq(appointments.familyId, familyId), gte(appointments.apptDatetime, nowIso)))
      .orderBy(asc(appointments.apptDatetime))
      .limit(1),
    db
      .select()
      .from(weeklyLogs)
      .where(eq(weeklyLogs.familyId, familyId))
      .orderBy(desc(weeklyLogs.logDate))
      .limit(3),
    db
      .select({ n: sql<number>`count(*)` })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, familyId), eq(familyMembers.status, "active"))),
  ]);

  const profile = pregnancyRows[0] ?? null;
  return {
    now,
    profile,
    ga: profile?.lmpDate ? calculateGestationalAge(profile.lmpDate) : null,
    daysLeft: profile?.dueDate ? daysUntilDueDate(profile.dueDate) : null,
    nextAppointment: apptRows[0] ?? null,
    recentLogs: logRows.map((r) => ({ ...r, symptoms: parseSymptoms(r.symptoms) })),
    memberCount: memberCount[0]?.n ?? 0,
  };
}

/**
 * ข้อมูลที่ layout ต้องใช้ทุกหน้า — ยิงใน batch เดียวเพื่อไม่ให้ทุกการเปลี่ยนหน้า
 * ต้องรอ query หลายรอบต่อกัน
 */
export async function getLayoutData(db: Db, familyId: string) {
  const now = Date.now();
  const horizonIso = new Date(now + 24 * 3600_000).toISOString();

  const [familyRows, apptRows] = await db.batch([
    db.select().from(families).where(eq(families.id, familyId)),
    db
      .select({
        id: appointments.id,
        apptDatetime: appointments.apptDatetime,
        title: appointments.title,
        doctorName: appointments.doctorName,
        location: appointments.location,
        reminderEnabled: appointments.reminderEnabled,
        reminderMinutesBefore: appointments.reminderMinutesBefore,
      })
      .from(appointments)
      .where(
        and(
          eq(appointments.familyId, familyId),
          gte(appointments.apptDatetime, new Date(now).toISOString()),
          lt(appointments.apptDatetime, horizonIso),
        ),
      )
      .orderBy(asc(appointments.apptDatetime)),
  ]);

  return {
    family: familyRows[0] ?? null,
    // มีนัดใน 24 ชม. -> จุดสีบนกระดิ่ง
    hasSoonAppointment: apptRows.length > 0,
    upcoming: apptRows,
    now,
  };
}

/** รูปในอัลบั้ม เรียงจากใหม่ไปเก่าตาม "วันที่ถ่าย" ไม่ใช่วันที่อัปโหลด */
export async function listPhotos(
  db: Db,
  familyId: string,
  type?: "ultrasound" | "family" | "other",
) {
  const rows = await db
    .select({
      id: photos.id,
      week: photos.week,
      takenAt: photos.takenAt,
      type: photos.type,
      pinned: photos.pinned,
      caption: photos.caption,
      r2Key: photos.r2Key,
      createdAt: photos.createdAt,
      uploaderName: user.name,
    })
    .from(photos)
    .innerJoin(user, eq(user.id, photos.uploadedBy))
    .where(type ? and(eq(photos.familyId, familyId), eq(photos.type, type)) : eq(photos.familyId, familyId))
    .orderBy(desc(photos.takenAt), desc(photos.createdAt));
  return rows;
}

export async function getPhotoById(db: Db, familyId: string, id: string) {
  return db
    .select({
      id: photos.id,
      week: photos.week,
      takenAt: photos.takenAt,
      type: photos.type,
      pinned: photos.pinned,
      caption: photos.caption,
      r2Key: photos.r2Key,
      createdAt: photos.createdAt,
      uploaderName: user.name,
    })
    .from(photos)
    .innerJoin(user, eq(user.id, photos.uploadedBy))
    .where(and(eq(photos.id, id), eq(photos.familyId, familyId)))
    .get();
}

/** จำนวนรูปที่แนบกับบันทึกสุขภาพแต่ละรายการ — ใช้โชว์ thumbnail ในการ์ด */
export async function countPhotosByLog(db: Db, familyId: string) {
  const rows = await db
    .select({ logId: photos.logId, n: sql<number>`count(*)` })
    .from(photos)
    .where(eq(photos.familyId, familyId))
    .groupBy(photos.logId);
  return new Map(rows.filter((r) => r.logId).map((r) => [r.logId as string, Number(r.n)]));
}

export async function getFamily(db: Db, familyId: string) {
  return db.select().from(families).where(eq(families.id, familyId)).get();
}
