/**
 * เงิน — จุดที่พลาดแล้วเงียบที่สุดในระบบ
 * ยอดรวมเพี้ยนทีละสตางค์ไม่มีใครสังเกต จนกว่าจะเอาไปกระทบยอดจริง
 */
import { describe, expect, it } from "vitest";
import { MAX_COST_SATANG, baht, formatBaht, parseBaht } from "@/lib/money";

describe("parseBaht()", () => {
  it("อ่านรูปแบบที่คนพิมพ์จริงได้", () => {
    expect(parseBaht("1200")).toBe(120000);
    expect(parseBaht("1,200")).toBe(120000);
    expect(parseBaht(" 1200 ")).toBe(120000);
    expect(parseBaht("฿1,200")).toBe(120000);
    expect(parseBaht("1200.50")).toBe(120050);
    expect(parseBaht("0.07")).toBe(7);
  });

  it("ว่าง = ยังไม่ได้ระบุ ไม่ใช่ศูนย์", () => {
    expect(parseBaht("")).toBeNull();
    expect(parseBaht("   ")).toBeNull();
    // ศูนย์ที่พิมพ์เองแปลว่าไปมาแล้วไม่เสียเงิน ต้องเก็บเป็น 0 จริงๆ
    expect(parseBaht("0")).toBe(0);
  });

  it("ปฏิเสธรูปแบบที่ใช้ไม่ได้", () => {
    for (const bad of ["abc", "-100", "1.234", "1..2", "1e5", "๑๒๐๐"]) {
      expect(parseBaht(bad), bad).toBeUndefined();
    }
  });

  it("ปฏิเสธเลขที่เกินเพดาน", () => {
    expect(parseBaht("10000000")).toBe(MAX_COST_SATANG);
    expect(parseBaht("10000001")).toBeUndefined();
  });

  it("ไม่พลาดเพราะ floating point", () => {
    // Number("0.07") * 100 = 7.000000000000001 ถ้าคูณ float ตรงๆ
    expect(parseBaht("0.07")).toBe(7);
    expect(parseBaht("0.29")).toBe(29);
    expect(parseBaht("1.15")).toBe(115);
    for (let i = 0; i < 100; i++) {
      const s = `${i}.${String(i % 100).padStart(2, "0")}`;
      expect(Number.isInteger(parseBaht(s)), s).toBe(true);
    }
  });
});

describe("formatBaht()", () => {
  it("ไม่โชว์ .00 ให้รก", () => {
    expect(formatBaht(120000)).toBe("1,200");
    expect(formatBaht(0)).toBe("0");
    expect(formatBaht(100)).toBe("1");
  });

  it("โชว์สตางค์เมื่อมีจริง", () => {
    expect(formatBaht(120050)).toBe("1,200.50");
    expect(formatBaht(7)).toBe("0.07");
  });

  it("ไป-กลับแล้วได้ค่าเดิม", () => {
    for (const v of [0, 7, 100, 12345, 120050, 999999999]) {
      expect(parseBaht(formatBaht(v)), String(v)).toBe(v);
    }
  });

  it("baht() ใส่สัญลักษณ์ให้", () => {
    expect(baht(120000)).toBe("฿1,200");
  });
});
