import { describe, expect, it } from "vitest";
import {
  FAST_GAIN_KG_PER_WEEK,
  bandOf,
  bmiOf,
  expectedGainAt,
  isFastGain,
  rangeOf,
  statusOf,
} from "@/lib/weight-gain";

/**
 * เกณฑ์น้ำหนักตั้งครรภ์ — ผิดแล้วหน้าจอจะบอกคนท้องว่าตัวเอง "ผิดเกณฑ์"
 * ทั้งที่ปกติดี หรือแย่กว่านั้นคือบอกว่าปกติทั้งที่ควรไปหาหมอ
 */
describe("BMI ก่อนตั้งครรภ์", () => {
  it("คำนวณถูกตามสูตร กก./เมตร²", () => {
    expect(bmiOf(52, 160)).toBe(20.3);
    expect(bmiOf(80, 160)).toBe(31.3);
  });

  it("ค่าที่เป็นไปไม่ได้คืน null ไม่ใช่ตัวเลขมั่ว", () => {
    expect(bmiOf(null, 160)).toBeNull();
    expect(bmiOf(52, null)).toBeNull();
    expect(bmiOf(5, 160)).toBeNull();
    expect(bmiOf(52, 40)).toBeNull();
  });

  it("แบ่งกลุ่มตามขอบเขตของ IOM", () => {
    expect(bandOf(18.4)).toBe("under");
    expect(bandOf(18.5)).toBe("normal");
    expect(bandOf(24.9)).toBe("normal");
    expect(bandOf(25)).toBe("over");
    expect(bandOf(29.9)).toBe("over");
    expect(bandOf(30)).toBe("obese");
    expect(bandOf(null)).toBeNull();
  });

  it("ช่วงน้ำหนักรวมตรงกับตาราง IOM 2009", () => {
    expect(rangeOf("under")).toMatchObject({ totalMin: 12.5, totalMax: 18 });
    expect(rangeOf("normal")).toMatchObject({ totalMin: 11.5, totalMax: 16 });
    expect(rangeOf("over")).toMatchObject({ totalMin: 7, totalMax: 11.5 });
    expect(rangeOf("obese")).toMatchObject({ totalMin: 5, totalMax: 9 });
  });
});

describe("ช่วงที่ควรเพิ่ม ณ สัปดาห์หนึ่ง", () => {
  /**
   * จุดที่พลาดง่ายที่สุด: ถ้าลากเส้นตรงจาก 0 ถึงน้ำหนักรวม คนไตรมาสแรกจะเห็นว่า
   * ตัวเอง "ต่ำกว่าเกณฑ์" ทั้งที่ไตรมาสแรกน้ำหนักแทบไม่ขึ้นเป็นเรื่องปกติ
   */
  it("ไตรมาสแรกขึ้นน้อยมาก ไม่ใช่เฉลี่ยเป็นเส้นตรงทั้งครรภ์", () => {
    const w8 = expectedGainAt("normal", 8);
    expect(w8.max).toBeLessThan(1.5);
    // ถ้าเฉลี่ยเส้นตรง สัปดาห์ 8 จะคาดไว้ราว 2.3-3.2 กก. ซึ่งสูงเกินจริงมาก
    expect(w8.max).toBeLessThan(11.5 * (8 / 40));
  });

  it("สัปดาห์ 40 ได้ใกล้เคียงช่วงรวมของกลุ่มนั้น", () => {
    const n = expectedGainAt("normal", 40);
    expect(n.min).toBeGreaterThanOrEqual(10);
    expect(n.min).toBeLessThanOrEqual(13);
    expect(n.max).toBeGreaterThanOrEqual(14.5);
    expect(n.max).toBeLessThanOrEqual(17.5);
  });

  it("กลุ่มที่ BMI สูงกว่า ต้องมีช่วงที่ต่ำกว่าเสมอ", () => {
    for (const w of [20, 30, 40]) {
      const u = expectedGainAt("under", w);
      const n = expectedGainAt("normal", w);
      const o = expectedGainAt("over", w);
      const ob = expectedGainAt("obese", w);
      expect(u.max).toBeGreaterThan(n.max);
      expect(n.max).toBeGreaterThan(o.max);
      expect(o.max).toBeGreaterThan(ob.max);
    }
  });

  it("ช่วงเพิ่มขึ้นตามสัปดาห์เสมอ ไม่มีย้อนกลับ", () => {
    let prev = -1;
    for (let w = 0; w <= 40; w++) {
      const cur = expectedGainAt("normal", w).min;
      expect(cur).toBeGreaterThanOrEqual(prev);
      prev = cur;
    }
  });

  it("สัปดาห์นอกช่วงไม่ทำให้ค่าพุ่งหรือติดลบ", () => {
    expect(expectedGainAt("normal", -5).min).toBe(0);
    expect(expectedGainAt("normal", 99).max).toEqual(expectedGainAt("normal", 42).max);
  });
});

describe("บอกสถานะเทียบช่วง", () => {
  it("ต่ำ/ใน/สูงกว่าช่วง", () => {
    const r = { min: 5.4, max: 8.2 };
    expect(statusOf(4, r)).toBe("below");
    expect(statusOf(6.4, r)).toBe("within");
    expect(statusOf(9, r)).toBe("above");
  });

  it("ขอบเขตพอดีถือว่าอยู่ในช่วง ไม่ใช่นอกช่วง", () => {
    const r = { min: 5.4, max: 8.2 };
    expect(statusOf(5.4, r)).toBe("within");
    expect(statusOf(8.2, r)).toBe("within");
  });
});

describe("น้ำหนักขึ้นเร็วผิดปกติ", () => {
  it(`เกิน ${FAST_GAIN_KG_PER_WEEK} กก./สัปดาห์ ถือว่าเร็ว`, () => {
    expect(isFastGain(1.3, 1)).toBe(true);
    expect(isFastGain(1.0, 1)).toBe(false);
    // ชั่งห่างกันสองสัปดาห์ ต้องหารก่อน ไม่ใช่เทียบก้อนรวม
    expect(isFastGain(1.8, 2)).toBe(false);
    expect(isFastGain(2.4, 2)).toBe(true);
  });

  it("ระยะห่างเป็นศูนย์หรือติดลบ ต้องไม่หารด้วยศูนย์", () => {
    expect(isFastGain(5, 0)).toBe(false);
    expect(isFastGain(5, -1)).toBe(false);
  });
});
