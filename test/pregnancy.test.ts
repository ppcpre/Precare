/**
 * T6.1 — การคำนวณอายุครรภ์
 *
 * ไฟล์นี้เป็นหัวใจของแอป: ตัวเลขที่ผู้ใช้เห็นบน Dashboard, สัปดาห์ที่ auto-fill
 * ในฟอร์ม, และ countdown วันคลอด ล้วนมาจากที่นี่ทั้งหมด
 * มาตรฐาน: ครบกำหนด = 40 สัปดาห์ = 280 วันนับจาก LMP
 */
import { describe, expect, it } from "vitest";
import {
  calculateDueDate,
  calculateGestationalAge,
  calculateLmpFromDueDate,
  daysUntilDueDate,
  isPostpartum,
} from "@/lib/pregnancy";

const iso = (d: Date) => d.toISOString().slice(0, 10);

describe("calculateDueDate", () => {
  it("บวก 280 วันจาก LMP", () => {
    expect(iso(calculateDueDate("2026-03-10"))).toBe("2026-12-15");
  });

  it("ข้ามปีได้ถูกต้อง", () => {
    expect(iso(calculateDueDate("2026-11-01"))).toBe("2027-08-08");
  });

  it("ข้ามวันที่ 29 ก.พ. ของปีอธิกสุรทินได้", () => {
    // 2028 เป็นปีอธิกสุรทิน — 2027-06-01 + 280 วัน ต้องนับ 29 ก.พ. 2028 ด้วย
    const due = calculateDueDate("2027-06-01");
    expect(iso(due)).toBe("2028-03-07");
  });
});

describe("calculateLmpFromDueDate", () => {
  it("ย้อนกลับได้ตรงกับ calculateDueDate", () => {
    const lmp = "2026-03-10";
    expect(iso(calculateLmpFromDueDate(calculateDueDate(lmp)))).toBe(lmp);
  });

  it("ลบ 280 วันจากวันคาดคลอด", () => {
    expect(iso(calculateLmpFromDueDate("2026-12-15"))).toBe("2026-03-10");
  });
});

describe("calculateGestationalAge", () => {
  const at = (s: string) => new Date(`${s}T12:00:00Z`);

  it("วันแรกของ LMP = 0 สัปดาห์ 0 วัน", () => {
    const ga = calculateGestationalAge("2026-03-10", at("2026-03-10"));
    expect(ga).toMatchObject({ weeks: 0, days: 0, totalDays: 0 });
  });

  it("6 วันหลัง LMP ยังเป็นสัปดาห์ 0", () => {
    expect(calculateGestationalAge("2026-03-10", at("2026-03-16")).weeks).toBe(0);
  });

  it("7 วันหลัง LMP = สัปดาห์ที่ 1 พอดี", () => {
    const ga = calculateGestationalAge("2026-03-10", at("2026-03-17"));
    expect(ga.weeks).toBe(1);
    expect(ga.days).toBe(0);
  });

  it("ค่าที่ใช้ใน seed: LMP 10 มี.ค. ถึง 25 ส.ค. = 168 วัน = 24 สัปดาห์ 0 วัน", () => {
    // เลข "24 สัปดาห์ 3 วัน" ที่เห็นใน design canvas เป็นค่า mockup ไม่ได้คำนวณจริง
    // ของจริงคือ 168 วันพอดี หารด้วย 7 ลงตัว
    const ga = calculateGestationalAge("2026-03-10", at("2026-08-25"));
    expect(ga.totalDays).toBe(168);
    expect(ga.weeks).toBe(24);
    expect(ga.days).toBe(0);
  });

  it("อีก 3 วันถัดมาจึงเป็น 24 สัปดาห์ 3 วัน", () => {
    const ga = calculateGestationalAge("2026-03-10", at("2026-08-28"));
    expect(ga.weeks).toBe(24);
    expect(ga.days).toBe(3);
  });

  it("weeks*7 + days ต้องเท่ากับ totalDays เสมอ", () => {
    for (const d of ["2026-04-01", "2026-07-15", "2026-11-30"]) {
      const ga = calculateGestationalAge("2026-03-10", at(d));
      expect(ga.weeks * 7 + ga.days).toBe(ga.totalDays);
    }
  });

  it("วันที่ก่อน LMP ไม่ติดลบ — ปัดเป็น 0", () => {
    const ga = calculateGestationalAge("2026-03-10", at("2026-03-01"));
    expect(ga.totalDays).toBe(0);
    expect(ga.weeks).toBe(0);
  });
});

describe("ไตรมาส", () => {
  const at = (s: string) => new Date(`${s}T12:00:00Z`);
  const tri = (dateStr: string) => calculateGestationalAge("2026-03-10", at(dateStr)).trimester;

  it("สัปดาห์ 0–12 = ไตรมาส 1", () => {
    expect(tri("2026-03-10")).toBe(1); // wk 0
    expect(tri("2026-05-31")).toBe(1); // wk 11
  });

  it("สัปดาห์ 13–27 = ไตรมาส 2", () => {
    expect(tri("2026-06-09")).toBe(2); // wk 13
    expect(tri("2026-08-25")).toBe(2); // wk 24
  });

  it("สัปดาห์ 28 ขึ้นไป = ไตรมาส 3", () => {
    expect(tri("2026-09-22")).toBe(3); // wk 28
    expect(tri("2026-12-15")).toBe(3); // ครบกำหนด
  });

  it("รอยต่อ 12->13 และ 27->28 ต้องเปลี่ยนไตรมาสพอดี", () => {
    const lmp = "2026-03-10";
    const dayOf = (w: number) => at(iso(new Date(Date.parse(lmp) + w * 7 * 86400_000)));
    expect(calculateGestationalAge(lmp, dayOf(12)).trimester).toBe(1);
    expect(calculateGestationalAge(lmp, dayOf(13)).trimester).toBe(2);
    expect(calculateGestationalAge(lmp, dayOf(27)).trimester).toBe(2);
    expect(calculateGestationalAge(lmp, dayOf(28)).trimester).toBe(3);
  });
});

describe("daysUntilDueDate", () => {
  const at = (s: string) => new Date(`${s}T00:00:00Z`);

  it("ก่อนกำหนด = ค่าบวก", () => {
    expect(daysUntilDueDate("2026-12-15", at("2026-08-25"))).toBe(112);
  });

  it("วันครบกำหนดพอดี = 0", () => {
    expect(daysUntilDueDate("2026-12-15", at("2026-12-15"))).toBe(0);
  });

  it("เลยกำหนดแล้ว = ค่าติดลบ", () => {
    expect(daysUntilDueDate("2026-12-15", at("2026-12-20"))).toBe(-5);
  });
});

describe("isPostpartum", () => {
  const at = (s: string) => new Date(`${s}T00:00:00Z`);

  it("ยังไม่ถึงกำหนด = ยังไม่ใช่", () => {
    expect(isPostpartum("2026-12-15", at("2026-11-01"))).toBe(false);
  });

  it("เลยกำหนด 10 วัน ยังอยู่ใน buffer 2 สัปดาห์", () => {
    expect(isPostpartum("2026-12-15", at("2026-12-25"))).toBe(false);
  });

  it("เลยกำหนดเกิน 14 วัน = เข้าสู่ postpartum", () => {
    expect(isPostpartum("2026-12-15", at("2026-12-30"))).toBe(true);
  });
});
