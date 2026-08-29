/**
 * จัดกลุ่มรูปในอัลบั้ม
 *
 * บั๊กเดิมคือหัวกลุ่มเอาวันที่ของรูปใบแรกมาแปะทั้งกลุ่ม
 * เทสต์ชุดนี้จึงเน้นว่าแต่ละวันต้องแยกจากกันจริง ไม่ยุบรวม
 */
import { describe, expect, it } from "vitest";
import { dayKeyOf, groupByMonthDay, monthKeyOf } from "@/lib/album-groups";

const p = (takenAt: string, week: number | null = null, id = takenAt) => ({
  id,
  takenAt,
  week,
});

describe("dayKeyOf / monthKeyOf", () => {
  it("ตัดจากสตริงตรงๆ ไม่ผ่าน Date", () => {
    expect(dayKeyOf("2026-08-26")).toBe("2026-08-26");
    expect(monthKeyOf("2026-08-26")).toBe("2026-08");
  });

  it("เที่ยงคืนไม่เลื่อนไปวันก่อนหน้า", () => {
    // ถ้าแปลงเป็น Date ใน timezone ลบ วันที่ 1 เวลา 00:00 จะกลายเป็นเดือนก่อน
    expect(monthKeyOf("2026-08-01T00:00:00")).toBe("2026-08");
    expect(dayKeyOf("2026-08-01T00:00:00")).toBe("2026-08-01");
  });
});

describe("groupByMonthDay()", () => {
  it("แยกวันในเดือนเดียวกันออกจากกัน ไม่ยุบเป็นกลุ่มเดียว", () => {
    // นี่คือบั๊กเดิม — สามวันนี้เคยถูกยุบเป็นกลุ่มเดียวแล้วแปะวันที่ของใบแรก
    const months = groupByMonthDay([
      p("2026-08-26", 24),
      p("2026-08-24", 24),
      p("2026-08-22", 24),
    ]);
    expect(months).toHaveLength(1);
    expect(months[0].days.map((d) => d.key)).toEqual([
      "2026-08-26",
      "2026-08-24",
      "2026-08-22",
    ]);
  });

  it("เรียงเดือนและวันจากใหม่ไปเก่า", () => {
    const months = groupByMonthDay([
      p("2026-07-12"),
      p("2026-09-02"),
      p("2026-08-26"),
      p("2026-08-05"),
    ]);
    expect(months.map((m) => m.key)).toEqual(["2026-09", "2026-08", "2026-07"]);
    expect(months[1].days.map((d) => d.key)).toEqual(["2026-08-26", "2026-08-05"]);
  });

  it("นับจำนวนรูปต่อเดือนถูกต้อง", () => {
    const months = groupByMonthDay([
      p("2026-08-26", 24, "a"),
      p("2026-08-26", 24, "b"),
      p("2026-08-22", 24, "c"),
      p("2026-07-12", null, "d"),
    ]);
    expect(months[0].count).toBe(3);
    expect(months[1].count).toBe(1);
  });

  it("สัปดาห์ห้อยที่หัววัน ไม่ใช่ที่รูปทีละใบ", () => {
    const months = groupByMonthDay([p("2026-08-26", 24), p("2026-08-26", 24)]);
    expect(months[0].days[0].week).toBe(24);
  });

  it("วันที่ไม่มีสัปดาห์คืน null ไม่ใช่ 0", () => {
    // 0 จะไปแสดงเป็น "สัปดาห์ 0" ซึ่งไม่มีอยู่จริง
    const months = groupByMonthDay([p("2026-07-12", null)]);
    expect(months[0].days[0].week).toBeNull();
  });

  it("รูปไม่มีสัปดาห์ยังเข้ากลุ่มตามเดือนได้ปกติ", () => {
    // ผลพลอยได้จากการเลิกจัดตามสัปดาห์ — ไม่มีกลุ่ม "ไม่ระบุสัปดาห์" อีกแล้ว
    const months = groupByMonthDay([p("2026-08-26", 24), p("2026-07-12", null)]);
    expect(months).toHaveLength(2);
    expect(months[1].days[0].week).toBeNull();
    expect(months[1].count).toBe(1);
  });

  it("ข้อมูลเก่าที่สัปดาห์ไม่ตรงกันในวันเดียว ใช้ค่าที่พบบ่อยสุด", () => {
    const months = groupByMonthDay([
      p("2026-08-26", 24, "a"),
      p("2026-08-26", 24, "b"),
      p("2026-08-26", 23, "c"),
    ]);
    expect(months[0].days[0].week).toBe(24);
  });

  it("รูปบางใบไม่มีสัปดาห์ แต่วันนั้นยังได้แท็กจากใบที่มี", () => {
    const months = groupByMonthDay([p("2026-08-26", null, "a"), p("2026-08-26", 24, "b")]);
    expect(months[0].days[0].week).toBe(24);
  });

  it("ไม่มีรูปเลยคืนอาเรย์ว่าง", () => {
    expect(groupByMonthDay([])).toEqual([]);
  });

  it("ไม่สลับลำดับรูปภายในวัน", () => {
    // query เรียงมาแล้ว ถ้าเรียงซ้ำในนี้จะทับลำดับที่ตั้งใจไว้
    const months = groupByMonthDay([
      p("2026-08-26", 24, "first"),
      p("2026-08-26", 24, "second"),
    ]);
    expect(months[0].days[0].items.map((i) => i.id)).toEqual(["first", "second"]);
  });
});
