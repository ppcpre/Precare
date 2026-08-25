/**
 * ตารางของ Better Auth
 *
 * โครงนี้ไม่ได้เขียนจากความจำ — อ่านจาก getAuthTables() ของ better-auth 1.7.1
 * ตรงๆ ตาม config ที่เราจะใช้จริง (emailAndPassword + google + additionalFields)
 *
 * ⚠️ อย่าแก้ field ของ 4 ตารางนี้เอง ถ้าอัปเกรด better-auth ให้รัน
 *    `npx @better-auth/cli generate` แล้วเทียบว่ามีอะไรเปลี่ยน
 * ⚠️ ฟิลด์ของแอปเรา (activeFamilyId) อยู่ในตาราง user ผ่าน additionalFields
 *    ห้ามสร้างตาราง users แยกออกมาเด็ดขาด จะกลายเป็นผู้ใช้สองชุดที่ต้อง sync เอง
 */
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const user = sqliteTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  /** อีเมล = ชื่อผู้ใช้ ไม่มี username แยก */
  email: text("email").notNull().unique(),
  emailVerified: integer("email_verified", { mode: "boolean" }).notNull().default(false),
  /** avatar — จาก Google หรือที่อัปโหลดเองลง R2 (T5.12) */
  image: text("image"),
  /** ฟิลด์ของแอปเรา: family ที่กำลังเปิดอยู่ · MVP บังคับ 1 user = 1 active family */
  activeFamilyId: text("active_family_id"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  /** อายุ 60 วัน + rolling refresh — ปิดแท็บแล้วเปิดใหม่ยังล็อกอินอยู่ */
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  token: text("token").notNull().unique(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const account = sqliteTable("account", {
  id: text("id").primaryKey(),
  issuer: text("issuer").notNull(),
  accountId: text("account_id").notNull(),
  /** 'credential' = อีเมล/รหัสผ่าน · 'google' = OAuth */
  providerId: text("provider_id").notNull(),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: integer("access_token_expires_at", { mode: "timestamp" }),
  refreshTokenExpiresAt: integer("refresh_token_expires_at", { mode: "timestamp" }),
  scope: text("scope"),
  /** scrypt hash — มีเฉพาะ providerId='credential' */
  password: text("password"),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});

export const verification = sqliteTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp" }).notNull(),
  createdAt: integer("created_at", { mode: "timestamp" }).notNull(),
  updatedAt: integer("updated_at", { mode: "timestamp" }).notNull(),
});
