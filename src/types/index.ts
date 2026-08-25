/**
 * Type ของโดเมน — derive จาก Drizzle schema ทั้งหมด ไม่เขียนซ้ำด้วยมือ
 * แก้ schema ที่เดียว type ขยับตามเอง
 *
 * ⚠️ ไฟล์เดิมใน scaffold เป็นโครง per-user + Firebase ที่ไม่มีแนวคิด family เลย
 *    เขียนใหม่ทั้งไฟล์ใน T1.4 ของเก่าใช้ต่อไม่ได้เลยแม้แต่บรรทัดเดียว
 */
import type {
  user, families, familyMembers, familyInvites,
  pregnancyProfiles, weeklyLogs, appointments, photos,
} from "@/db/schema";
import type { ROLES, MOODS, PHOTO_TYPES, INVITE_STATUS } from "@/db/schema";

export type Role = (typeof ROLES)[number];
export type Mood = (typeof MOODS)[number];
export type PhotoType = (typeof PHOTO_TYPES)[number];
export type InviteStatus = (typeof INVITE_STATUS)[number];

export type User = typeof user.$inferSelect;
export type Family = typeof families.$inferSelect;
export type FamilyMember = typeof familyMembers.$inferSelect;
export type FamilyInvite = typeof familyInvites.$inferSelect;
export type PregnancyProfile = typeof pregnancyProfiles.$inferSelect;
export type WeeklyLog = typeof weeklyLogs.$inferSelect;
export type Appointment = typeof appointments.$inferSelect;
export type Photo = typeof photos.$inferSelect;

export type NewFamily = typeof families.$inferInsert;
export type NewWeeklyLog = typeof weeklyLogs.$inferInsert;
export type NewAppointment = typeof appointments.$inferInsert;
export type NewPhoto = typeof photos.$inferInsert;

/** weekly_logs.symptoms เก็บเป็น JSON string ใน D1 — ชั้นบนควรได้ array */
export type WeeklyLogView = Omit<WeeklyLog, "symptoms"> & { symptoms: string[] };

/** สมาชิกพร้อมข้อมูลผู้ใช้ สำหรับหน้า /family */
export type MemberView = Pick<FamilyMember, "id" | "role" | "status" | "joinedAt"> &
  Pick<User, "name" | "email" | "image"> & { userId: string; isMe: boolean };

export const parseSymptoms = (raw: string | null): string[] => {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
};

export const stringifySymptoms = (list: string[]): string | null =>
  list.length ? JSON.stringify(list) : null;
