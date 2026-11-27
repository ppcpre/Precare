import { describe, expect, it } from "vitest";
import {
  AGE_SLOTS,
  OVER_SLOT_ID,
  SLOT_COUNT,
  addMonths,
  ageLabel,
  daysBetween,
  slotIdOf,
  slotStart,
} from "@/lib/child-age";

describe("addMonths", () => {
  it("บวกเดือนธรรมดา", () => {
    expect(addMonths("2026-01-15", 1)).toBe("2026-02-15");
    expect(addMonths("2026-01-15", 12)).toBe("2027-01-15");
  });

  it("หนีบวันสิ้นเดือน ไม่ม้วนไปเดือนถัดไป", () => {
    // 31 ม.ค. + 1 เดือน ต้องเป็น 28 ก.พ. — ถ้าใช้ setMonth ตรงๆ จะได้ 3 มี.ค.
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-03-31", 1)).toBe("2026-04-30");
    expect(addMonths("2026-01-30", 1)).toBe("2026-02-28");
  });

  it("ปีอธิกสุรทิน", () => {
    expect(addMonths("2024-02-29", 12)).toBe("2025-02-28");
    expect(addMonths("2023-12-31", 2)).toBe("2024-02-29");
  });

  it("ข้ามปี", () => {
    expect(addMonths("2026-11-10", 3)).toBe("2027-02-10");
    expect(addMonths("2026-11-10", 36)).toBe("2029-11-10");
  });
});

describe("daysBetween", () => {
  it("นับวันเต็ม ข้ามเดือนและปีอธิกสุรทิน", () => {
    expect(daysBetween("2026-01-01", "2026-01-01")).toBe(0);
    expect(daysBetween("2026-01-01", "2026-01-08")).toBe(7);
    expect(daysBetween("2024-02-28", "2024-03-01")).toBe(2);
    expect(daysBetween("2026-01-10", "2026-01-01")).toBe(-9);
  });
});

describe("AGE_SLOTS", () => {
  it("มี 26 ช่อง เรียงจากแรกเกิดถึงก่อน 3 ขวบ", () => {
    expect(AGE_SLOTS).toHaveLength(SLOT_COUNT);
    expect(AGE_SLOTS[0].label).toBe("สัปดาห์ที่ 1");
    expect(AGE_SLOTS[7].label).toBe("สัปดาห์ที่ 8");
    expect(AGE_SLOTS[8].label).toBe("2 เดือน");
    expect(AGE_SLOTS[17].label).toBe("11 เดือน");
    expect(AGE_SLOTS[18].label).toBe("1 ขวบ");
    expect(AGE_SLOTS[25].label).toBe("2 ขวบ 9 เดือน");
  });

  it("id ไม่ซ้ำกัน — ใช้เป็น key", () => {
    expect(new Set(AGE_SLOTS.map((s) => s.id)).size).toBe(SLOT_COUNT);
  });

  it("ช่องรายไตรมาสเว้นทีละ 3 เดือน ไม่ข้ามช่อง", () => {
    const q = AGE_SLOTS.filter((s) => s.kind === "quarter").map((s) => s.n);
    expect(q).toEqual([12, 15, 18, 21, 24, 27, 30, 33]);
  });
});

describe("slotIdOf", () => {
  const born = "2026-03-10";

  it("วันเกิดเองอยู่สัปดาห์ที่ 1", () => {
    expect(slotIdOf(born, "2026-03-10")).toBe("w1");
    expect(slotIdOf(born, "2026-03-16")).toBe("w1");
  });

  it("ขึ้นสัปดาห์ใหม่ทุก 7 วัน", () => {
    expect(slotIdOf(born, "2026-03-17")).toBe("w2");
    expect(slotIdOf(born, "2026-03-24")).toBe("w3");
  });

  it("สัปดาห์ที่ 8 ยืดไปจนถึงวันครบ 2 เดือน ไม่มีช่องว่างคั่น", () => {
    // วันที่ 56 คือต้นสัปดาห์ที่ 9 ตามการหาร แต่ยังไม่ครบ 2 เดือน (= 5 พ.ค.)
    expect(daysBetween(born, "2026-05-05")).toBe(56);
    expect(slotIdOf(born, "2026-05-05")).toBe("w8");
    expect(slotIdOf(born, "2026-05-09")).toBe("w8");
  });

  it("ครบ 2 เดือนพอดีคือช่อง 2 เดือน ไม่ใช่สัปดาห์ที่ 8", () => {
    expect(slotIdOf(born, "2026-05-10")).toBe("m2");
    expect(slotIdOf(born, "2026-06-09")).toBe("m2");
  });

  it("ครบ 3 เดือนพอดีขยับช่อง", () => {
    expect(slotIdOf(born, "2026-06-10")).toBe("m3");
  });

  it("ขึ้นปีใช้ช่องราย 3 เดือน", () => {
    expect(slotIdOf(born, "2027-03-10")).toBe("q12");
    expect(slotIdOf(born, "2027-06-09")).toBe("q12");
    expect(slotIdOf(born, "2027-06-10")).toBe("q15");
    expect(slotIdOf(born, "2028-03-10")).toBe("q24");
    expect(slotIdOf(born, "2028-12-10")).toBe("q33");
  });

  it("ครบ 3 ขวบพอดีตกช่องเกิน — ไม่ปิดกั้นการอัปโหลด", () => {
    expect(slotIdOf(born, "2029-03-09")).toBe("q33");
    expect(slotIdOf(born, "2029-03-10")).toBe(OVER_SLOT_ID);
    expect(slotIdOf(born, "2035-01-01")).toBe(OVER_SLOT_ID);
  });

  it("ถ่ายก่อนวันเกิดคืน null — อัลตราซาวด์ต้องไม่ถูกดูดเข้าสัปดาห์ที่ 1", () => {
    expect(slotIdOf(born, "2026-03-09")).toBeNull();
    expect(slotIdOf(born, "2025-11-01")).toBeNull();
  });

  it("เด็กที่เกิดวันสิ้นเดือนไม่ข้ามช่อง", () => {
    const b = "2026-01-31";
    expect(slotIdOf(b, "2026-03-31")).toBe("m2");
    expect(slotIdOf(b, "2026-03-30")).toBe("w8");
    // ทุกเดือนต่อจากนี้ต้องมีช่องรับเสมอ ไม่มีวันไหนหลุดเป็น null
    for (let m = 2; m <= 11; m++) {
      expect(slotIdOf(b, addMonths(b, m))).toBe(`m${m}`);
    }
  });

  it("ทุกวันตั้งแต่เกิดถึง 3 ขวบมีช่องรับ ไม่มีวันไหนหลุด", () => {
    const b = "2026-01-31";
    const ids = new Set<string>();
    for (let d = 0; d < 365 * 3; d++) {
      const ymd = new Date(Date.parse(`${b}T00:00:00Z`) + d * 86_400_000)
        .toISOString()
        .slice(0, 10);
      const id = slotIdOf(b, ymd);
      expect(id, `วันที่ ${ymd} ไม่มีช่องรับ`).not.toBeNull();
      ids.add(id!);
    }
    // ทุกช่องที่ประกาศไว้ต้องมีวันจริงตกลงไปอย่างน้อยหนึ่งวัน ไม่มีช่องตาย
    for (const s of AGE_SLOTS) {
      expect(ids.has(s.id), `ช่อง ${s.label} ไม่มีวันไหนตกลงไปเลย`).toBe(true);
    }
  });
});

describe("slotStart", () => {
  it("คืนวันแรกของช่อง", () => {
    const born = "2026-03-10";
    expect(slotStart(born, AGE_SLOTS[0])).toBe("2026-03-10");
    expect(slotStart(born, AGE_SLOTS[1])).toBe("2026-03-17");
    expect(slotStart(born, AGE_SLOTS[8])).toBe("2026-05-10");
    expect(slotStart(born, AGE_SLOTS[18])).toBe("2027-03-10");
  });

  it("วันแรกของช่องตกอยู่ในช่องนั้นจริง", () => {
    const born = "2026-01-31";
    for (const s of AGE_SLOTS) {
      expect(slotIdOf(born, slotStart(born, s)), s.label).toBe(s.id);
    }
  });
});

describe("ageLabel", () => {
  const born = "2026-03-10";

  it("ช่วงแรกนับเป็นวัน", () => {
    expect(ageLabel(born, "2026-03-10")).toBe("แรกเกิด");
    expect(ageLabel(born, "2026-03-15")).toBe("5 วัน");
    expect(ageLabel(born, "2026-03-23")).toBe("13 วัน");
    expect(ageLabel(born, "2026-03-24")).toBe("2 สัปดาห์");
  });

  it("ครบเดือนแล้วนับเป็นเดือนกับวัน", () => {
    expect(ageLabel(born, "2026-04-10")).toBe("1 เดือน");
    expect(ageLabel(born, "2026-06-22")).toBe("3 เดือน 12 วัน");
  });

  it("เกินสองขวบนับเป็นขวบ", () => {
    expect(ageLabel(born, "2028-03-10")).toBe("2 ขวบ");
    expect(ageLabel(born, "2028-09-10")).toBe("2 ขวบ 6 เดือน");
  });

  it("ก่อนวันเกิดไม่โกหกว่าอายุติดลบ", () => {
    expect(ageLabel(born, "2026-03-01")).toBe("ยังไม่เกิด");
  });
});
