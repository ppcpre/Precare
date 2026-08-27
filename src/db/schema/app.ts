/**
 * ตารางฝั่งแอป — อ้างอิง docs/architecture.md หัวข้อ 1.2
 *
 * timestamp ของตารางกลุ่มนี้เก็บเป็น TEXT ISO 8601 (ต่างจากตาราง auth ที่เป็น
 * integer timestamp เพราะ adapter ของ Better Auth กำหนดมาแบบนั้น)
 * เก็บเป็น text เพื่อให้อ่านออกตอนเปิดดูใน D1 console และใช้ฟังก์ชันวันที่ของ SQLite ได้ตรงๆ
 */
import { sqliteTable, text, integer, real, index, uniqueIndex } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { user } from "./auth";

const nowIso = sql`(datetime('now'))`;

export const families = sqliteTable("families", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  ownerId: text("owner_id").notNull().references(() => user.id),
  createdAt: text("created_at").notNull().default(nowIso),
});

export const ROLES = ["owner", "editor", "viewer"] as const;
export const MEMBER_STATUS = ["active", "invited", "removed"] as const;

export const familyMembers = sqliteTable(
  "family_members",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    userId: text("user_id").notNull().references(() => user.id),
    role: text("role", { enum: ROLES }).notNull(),
    status: text("status", { enum: MEMBER_STATUS }).notNull().default("active"),
    joinedAt: text("joined_at").notNull().default(nowIso),
  },
  (t) => [
    uniqueIndex("uq_member_family_user").on(t.familyId, t.userId),
    // ใช้บ่อยสุด: หา family ที่ user คนนี้อยู่ ตอนเช็ค authz ทุก request
    index("idx_members_user").on(t.userId, t.status),
  ],
);

export const INVITE_STATUS = ["pending", "accepted", "declined", "expired"] as const;

export const familyInvites = sqliteTable(
  "family_invites",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    invitedEmail: text("invited_email").notNull(),
    /** เชิญเป็น owner ไม่ได้ — owner มีได้คนเดียวคือคนสร้าง family */
    invitedRole: text("invited_role", { enum: ["editor", "viewer"] }).notNull(),
    invitedBy: text("invited_by").notNull().references(() => user.id),
    status: text("status", { enum: INVITE_STATUS }).notNull().default("pending"),
    createdAt: text("created_at").notNull().default(nowIso),
    /** ลิงก์เชิญอายุ 7 วัน และใช้ได้ครั้งเดียว */
    expiresAt: text("expires_at").notNull(),
  },
  (t) => [index("idx_invites_family").on(t.familyId, t.status)],
);

export const pregnancyProfiles = sqliteTable("pregnancy_profiles", {
  familyId: text("family_id").primaryKey().references(() => families.id, { onDelete: "cascade" }),
  /** วันประจำเดือนครั้งสุดท้าย — ต้นทางของการคำนวณทุกอย่าง */
  lmpDate: text("lmp_date"),
  /** คำนวณจาก lmpDate + 280 วัน (ดู src/lib/pregnancy.ts) */
  dueDate: text("due_date"),
  status: text("status", { enum: ["pregnant", "postpartum"] }).notNull().default("pregnant"),
  updatedAt: text("updated_at").notNull().default(nowIso),
});

export const MOODS = ["great", "good", "okay", "tired", "bad"] as const;

export const weeklyLogs = sqliteTable(
  "weekly_logs",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    recordedBy: text("recorded_by").notNull().references(() => user.id),
    week: integer("week").notNull(),
    weight: real("weight"),
    bpSystolic: integer("bp_systolic"),
    bpDiastolic: integer("bp_diastolic"),
    /** JSON array string — SQLite ไม่มี array จริง parse/stringify ที่ชั้น data access */
    symptoms: text("symptoms"),
    mood: text("mood", { enum: MOODS }),
    note: text("note"),
    logDate: text("log_date").notNull(),
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [index("idx_logs_family").on(t.familyId, t.logDate)],
);


/** สีของกลุ่ม — จำกัดชุดไว้เพื่อให้ทุกกลุ่มยังอยู่ในพาเลตต์เดียวกับแอป */
export const CARE_GROUP_COLORS = ["peach", "sky", "sage", "plum", "clay"] as const;

/** สถานะการเบิก — ค่าฝากครรภ์เบิกประกันสังคมได้ ค่าทำฟันส่วนใหญ่เบิกไม่ได้ */
export const CLAIM_STATUSES = ["none", "done", "no"] as const;
export type ClaimStatus = (typeof CLAIM_STATUSES)[number];

/**
 * กลุ่มการรักษา — ใช้แยกยอดค่าใช้จ่ายตามเรื่องที่รักษา
 *
 * ทำเป็นตารางแทนที่จะเก็บชื่อเป็น text ในนัดหมายตรงๆ เพราะถ้าเก็บเป็น text
 * จะเปลี่ยนชื่อกลุ่มทีหลังไม่ได้ ต้องไล่แก้ทุกแถว และสะกดต่างนิดเดียว
 * ก็กลายเป็นคนละกลุ่มทันที
 */
export const careGroups = sqliteTable(
  "care_groups",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    color: text("color", { enum: CARE_GROUP_COLORS }).notNull().default("peach"),
    /** ซ่อนกลุ่มที่เลิกใช้ โดยไม่ลบเพื่อไม่ให้นัดหมายเก่าเสียกลุ่มไป */
    archived: integer("archived", { mode: "boolean" }).notNull().default(false),
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [index("idx_care_groups_family").on(t.familyId)],
);

export const appointments = sqliteTable(
  "appointments",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    createdBy: text("created_by").notNull().references(() => user.id),
    apptDatetime: text("appt_datetime").notNull(),
    title: text("title"),
    doctorName: text("doctor_name"),
    /** เพิ่มใน T1.1 — สเปกเดิมไม่มี แต่ฟอร์มที่ออกแบบไว้มีช่องนี้ */
    location: text("location"),
    note: text("note"),
    reminderEnabled: integer("reminder_enabled", { mode: "boolean" }).notNull().default(true),
    reminderMinutesBefore: integer("reminder_minutes_before").notNull().default(60),

    /** null = ยังไม่ได้เลือกกลุ่ม แสดงเป็น "ทั่วไป" ไม่บังคับให้เลือก */
    groupId: text("group_id").references(() => careGroups.id, { onDelete: "set null" }),

    /**
     * ค่าใช้จ่ายเก็บเป็นจำนวนเต็ม "สตางค์" ห้ามใช้ REAL เด็ดขาด
     * 120000 = 1,200 บาท — D1 เป็น SQLite ไม่มี DECIMAL ให้ใช้
     * ถ้าเก็บเป็น float ยอดรวมจะเพี้ยนในบางเคสแบบไล่ไม่เจอ
     *
     * null = ยังไม่ได้ระบุ · 0 = ไปมาแล้วแต่ไม่เสียเงิน
     * สองอย่างนี้คนละความหมาย ยอดรวมต้องนับเฉพาะที่ไม่ใช่ null
     */
    costSatang: integer("cost_satang"),
    claimStatus: text("claim_status", { enum: CLAIM_STATUSES }).notNull().default("none"),
    costNote: text("cost_note"),
  },
  (t) => [
    index("idx_appts_family").on(t.familyId, t.apptDatetime),
    index("idx_appts_group").on(t.groupId),
  ],
);

export const PHOTO_TYPES = ["ultrasound", "family", "other"] as const;

/** Phase 2 — สร้างตารางไว้ตั้งแต่ migration แรก แต่ยังไม่มีโค้ดเรียกใช้จนกว่าจะทำอัลบั้ม */
export const photos = sqliteTable(
  "photos",
  {
    id: text("id").primaryKey(),
    familyId: text("family_id").notNull().references(() => families.id, { onDelete: "cascade" }),
    /** ถ้าแนบมากับบันทึกสุขภาพ · ลบบันทึกแล้วรูปยังอยู่ในอัลบั้ม */
    logId: text("log_id").references(() => weeklyLogs.id, { onDelete: "set null" }),
    week: integer("week"),
    /** วันที่ "ถ่าย" ไม่ใช่วันที่อัปโหลด — คนอัปโหลดทีหลังเสมอ
     *  ถ้าใช้ createdAt จัดกลุ่ม รูปจะไปโผล่ผิดสัปดาห์ */
    takenAt: text("taken_at").notNull(),
    /** รูปหน้าปกของสัปดาห์นั้น — พอมีหลายสิบรูปกริดจะดูไม่ออกว่าอันไหนสำคัญ */
    pinned: integer("pinned", { mode: "boolean" }).notNull().default(false),
    type: text("type", { enum: PHOTO_TYPES }).notNull().default("other"),
    r2Key: text("r2_key").notNull(),
    /** เก็บ thumb แยก ไม่ให้กริดอัลบั้มโหลดรูปเต็มทุกใบ */
    thumbKey: text("thumb_key"),
    caption: text("caption"),
    uploadedBy: text("uploaded_by").notNull().references(() => user.id),
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [index("idx_photos_family").on(t.familyId, t.takenAt)],
);

export const STORAGE_KINDS = ["avatar", "photo", "asset"] as const;

/**
 * บัญชีไฟล์ทุกชิ้นที่เขียนลง R2
 *
 * ทำไมต้องมีตารางนี้: R2 ไม่มี API ให้ถามยอดใช้งานแบบเร็วๆ ต่อ request
 * การรวม SUM(size_bytes) จาก D1 เร็วกว่ามากและใช้บังคับโควตาแบบ realtime ได้
 *
 * ⚠️ ทุกครั้งที่ put ลง R2 ต้อง insert แถวนี้ และทุกครั้งที่ delete ต้องลบแถวด้วย
 *    ไม่งั้นยอดจะเพี้ยน — ใช้ผ่าน src/lib/storage.ts เท่านั้น อย่าเรียก R2 ตรง
 */
export const storageObjects = sqliteTable(
  "storage_objects",
  {
    id: text("id").primaryKey(),
    bucket: text("bucket", { enum: ["assets", "photos"] }).notNull(),
    key: text("key").notNull().unique(),
    sizeBytes: integer("size_bytes").notNull(),
    kind: text("kind", { enum: STORAGE_KINDS }).notNull(),
    /** null ได้สำหรับไฟล์ระบบที่ไม่ผูกกับครอบครัวไหน */
    familyId: text("family_id").references(() => families.id, { onDelete: "cascade" }),
    uploadedBy: text("uploaded_by").references(() => user.id),
    createdAt: text("created_at").notNull().default(nowIso),
  },
  (t) => [index("idx_storage_family").on(t.familyId)],
);
