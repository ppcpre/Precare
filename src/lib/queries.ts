/**
 * ฝั่งอ่าน — เรียกจาก React Server Component ตรงๆ ไม่ต้องมี REST endpoint
 *
 * ⚠️ ทุกฟังก์ชันในนี้ต้องรับ familyId ที่ผ่าน requireRole มาแล้วเท่านั้น
 *    ห้ามรับ familyId ดิบจาก searchParams หรือ props ของ client
 */
import { and, asc, desc, eq, gte, lt, sql } from "drizzle-orm";
import { headers } from "next/headers";
import type { Db } from "@/db";
import { getDb } from "@/db";
import { getAuth } from "@/lib/auth";
import { requireRole } from "@/lib/authz";
import {
  appointments, families, familyInvites, familyMembers,
  pregnancyProfiles, user, weeklyLogs,
} from "@/db/schema";
import { parseSymptoms, type Role, type WeeklyLogView } from "@/types";
import { calculateGestationalAge, daysUntilDueDate } from "@/lib/pregnancy";

/**
 * ด่านเดียวที่ RSC ใช้เปิดหน้า — คืน db + user + familyId + role ที่ผ่าน authz แล้ว
 * ถ้าไม่ผ่านจะโยน AuthzError ไม่ใช่คืน null เพื่อกันเผลอ render ต่อ
 */
export async function requireFamilyContext(min: Role = "viewer") {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("UNAUTHENTICATED");
  const db = await getDb();
  const familyId = session.user.activeFamilyId;
  if (!familyId) throw new Error("NO_ACTIVE_FAMILY");
  const role = await requireRole(db, familyId, session.user.id, min);
  return { db, user: session.user, familyId, role };
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

export async function listWeeklyLogs(db: Db, familyId: string, limit = 50): Promise<WeeklyLogView[]> {
  const rows = await db
    .select()
    .from(weeklyLogs)
    .where(eq(weeklyLogs.familyId, familyId))
    .orderBy(desc(weeklyLogs.logDate))
    .limit(limit);
  return rows.map((r) => ({ ...r, symptoms: parseSymptoms(r.symptoms) }));
}

export async function listAppointments(db: Db, familyId: string, when: "upcoming" | "past" = "upcoming") {
  const nowIso = new Date().toISOString();
  return db
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

export async function getFamily(db: Db, familyId: string) {
  return db.select().from(families).where(eq(families.id, familyId)).get();
}
