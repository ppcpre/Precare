import { describe, expect, it } from "vitest";
import { appointmentInput } from "@/lib/validation";
import { MAX_REMINDERS } from "@/db/schema";

/**
 * เพดานเวลาเตือนต้องกั้นที่ schema ไม่ใช่แค่ใน UI
 *
 * ชิปที่กดไม่ได้กันได้แค่คนที่กดผ่านหน้าจอ — Server Action คือ endpoint จริง
 * ที่ยิงตรงได้ และแต่ละครั้งเท่ากับ push หนึ่งใบต่อสมาชิกทุกคนในครอบครัว
 */
const base = { apptDatetime: "2026-10-01T09:00:00", reminderEnabled: true };

describe("เวลาเตือนของนัดหมาย", () => {
  it(`เกิน ${MAX_REMINDERS} ครั้งไม่ผ่าน`, () => {
    const r = appointmentInput.safeParse({ ...base, reminderOffsets: [1440, 180, 60, 30] });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].message).toContain(String(MAX_REMINDERS));
  });

  it(`${MAX_REMINDERS} ครั้งพอดีผ่าน`, () => {
    expect(appointmentInput.safeParse({ ...base, reminderOffsets: [1440, 60, 30] }).success).toBe(true);
  });

  it("ตัดตัวซ้ำทิ้ง ไม่งั้นเลือก 60 สองครั้งจะได้ push สองใบติดกัน", () => {
    const r = appointmentInput.parse({ ...base, reminderOffsets: [60, 60, 30] });
    expect(r.reminderOffsets).toEqual([60, 30]);
  });

  it("เรียงจากไกลไปใกล้เสมอ ไม่ว่าจะส่งมาลำดับไหน", () => {
    const r = appointmentInput.parse({ ...base, reminderOffsets: [30, 1440, 60] });
    expect(r.reminderOffsets).toEqual([1440, 60, 30]);
  });

  it("ไม่เลือกเลยได้ = ไม่เตือน", () => {
    expect(appointmentInput.parse({ ...base, reminderOffsets: [] }).reminderOffsets).toEqual([]);
  });

  it("ค่าติดลบหรือเกิน 7 วันไม่ผ่าน", () => {
    expect(appointmentInput.safeParse({ ...base, reminderOffsets: [-5] }).success).toBe(false);
    expect(appointmentInput.safeParse({ ...base, reminderOffsets: [10081] }).success).toBe(false);
  });
});
