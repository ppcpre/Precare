/** Zod schema — derive จาก Drizzle ตรงไหนได้ derive ตรงนั้น จะได้ไม่ต้อง sync มือ */
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";
import { weeklyLogs, appointments } from "@/db/schema";
import { MOODS } from "@/db/schema";

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง");

export const weeklyLogInput = createInsertSchema(weeklyLogs)
  // 4 ฟิลด์นี้ server เป็นคนใส่ ไม่รับจาก client เด็ดขาด
  .omit({ id: true, familyId: true, recordedBy: true, createdAt: true })
  .extend({
    week: z.number().int().min(1).max(45),
    weight: z.number().min(20).max(200).nullable().optional(),
    bpSystolic: z.number().int().min(50).max(260).nullable().optional(),
    bpDiastolic: z.number().int().min(30).max(180).nullable().optional(),
    mood: z.enum(MOODS).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    logDate: isoDate,
    // รับเป็น array แล้วค่อย stringify ตอนเขียนลง D1
    symptoms: z.array(z.string().max(50)).max(20).default([]),
  });

export const appointmentInput = createInsertSchema(appointments)
  // ตัดฟิลด์ค่าใช้จ่ายออกจากฟอร์มนัดหมาย แก้ได้ที่หน้าค่าใช้จ่ายที่เดียว
  // ไม่งั้นมีสองทางเขียนค่าเดียวกัน แล้วต้องคอยกันไม่ให้ทับกันเอง
  .omit({
    id: true,
    familyId: true,
    createdBy: true,
    costSatang: true,
    claimStatus: true,
    costNote: true,
  })
  .extend({
    apptDatetime: z.string().min(10, "ต้องระบุวันและเวลา"),
    title: z.string().max(120).nullable().optional(),
    doctorName: z.string().max(120).nullable().optional(),
    location: z.string().max(200).nullable().optional(),
    note: z.string().max(2000).nullable().optional(),
    reminderEnabled: z.boolean().default(true),
    reminderMinutesBefore: z.number().int().min(0).max(10080).default(60),
    /** null = ไม่เลือกกลุ่ม แสดงเป็น "ทั่วไป" — ตรวจว่าเป็นกลุ่มของครอบครัวนี้ใน action */
    groupId: z.string().min(1).nullable().optional(),
  });

export const onboardingInput = z
  .object({
    familyName: z.string().min(1, "กรุณาตั้งชื่อครอบครัว").max(80),
    lmpDate: isoDate.nullable().optional(),
    dueDate: isoDate.nullable().optional(),
  })
  .refine((v) => !(v.lmpDate && v.dueDate), {
    message: "ระบุ LMP หรือวันคาดคลอดอย่างใดอย่างหนึ่ง",
  });

export const pregnancyInput = z
  .object({ lmpDate: isoDate.nullable(), dueDate: isoDate.nullable() })
  .refine((v) => Boolean(v.lmpDate) !== Boolean(v.dueDate), {
    message: "ระบุ LMP หรือวันคาดคลอดอย่างใดอย่างหนึ่ง",
  });

export const inviteInput = z.object({
  email: z.string().email("รูปแบบอีเมลไม่ถูกต้อง").max(200),
  role: z.enum(["editor", "viewer"]),
});

export const idInput = z.object({ id: z.string().min(1) });
