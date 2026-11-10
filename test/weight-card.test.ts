import { describe, expect, it } from "vitest";
import { buildWeightCard, weightAxisTicks } from "@/lib/weight-card";

const base = {
  lmpDate: "2026-04-01",
  heightCm: 160,
  prePregnancyWeight: 52,
  logs: [] as { week: number; weight: number | null }[],
};

describe("การ์ดน้ำหนัก", () => {
  it("ยังไม่รู้อายุครรภ์ = ไม่ต้องแสดงการ์ดนี้", () => {
    expect(buildWeightCard({ ...base, lmpDate: null })).toEqual({ state: "no_pregnancy" });
  });

  /** ห้ามเดาเกณฑ์แทนเมื่อข้อมูลไม่ครบ ไม่งั้นจะบอกคนท้องผิดตั้งแต่ตัวเลขแรก */
  it("ขาดส่วนสูงหรือน้ำหนักก่อนตั้งครรภ์ = ชวนให้กรอก ไม่ใช่คำนวณมั่ว", () => {
    expect(buildWeightCard({ ...base, heightCm: null }).state).toBe("need_setup");
    expect(buildWeightCard({ ...base, prePregnancyWeight: null }).state).toBe("need_setup");
  });

  it("มีเกณฑ์แล้วแต่ยังไม่เคยชั่ง = ชวนให้บันทึก", () => {
    const v = buildWeightCard({ ...base, logs: [{ week: 10, weight: null }] });
    expect(v).toMatchObject({ state: "need_log", bmi: 20.3, band: "normal" });
  });

  it("คิดน้ำหนักที่เพิ่มจากก่อนตั้งครรภ์ ไม่ใช่จากครั้งแรกที่ชั่ง", () => {
    const v = buildWeightCard({
      ...base,
      logs: [{ week: 12, weight: 53 }, { week: 24, weight: 58.4 }],
    });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.points).toEqual([
      { week: 12, gain: 1 },
      { week: 24, gain: 6.4 },
    ]);
  });

  it("เทียบกับเกณฑ์ของสัปดาห์ล่าสุด ไม่ใช่สัปดาห์อื่น", () => {
    const v = buildWeightCard({ ...base, logs: [{ week: 24, weight: 58.4 }] });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.current.week).toBe(24);
    expect(v.status).toBe("within");
  });

  it("บันทึกไม่เรียงลำดับก็ต้องได้จุดล่าสุดถูกต้อง", () => {
    const v = buildWeightCard({
      ...base,
      logs: [{ week: 24, weight: 58.4 }, { week: 12, weight: 53 }, { week: 20, weight: 56 }],
    });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.points.map((p) => p.week)).toEqual([12, 20, 24]);
    expect(v.current.week).toBe(24);
  });

  it("น้ำหนักลดในไตรมาสแรกต้องแสดงได้ ไม่ใช่พังหรือปัดเป็นศูนย์", () => {
    const v = buildWeightCard({ ...base, logs: [{ week: 8, weight: 50.5 }] });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.current.gain).toBe(-1.5);
    expect(v.status).toBe("below");
  });

  it("ขึ้นเร็วผิดปกติระหว่างสองครั้งล่าสุด", () => {
    const fast = buildWeightCard({
      ...base,
      logs: [{ week: 23, weight: 57 }, { week: 24, weight: 58.4 }],
    });
    expect(fast.state === "ready" && fast.fastGain).toBe(true);

    const normal = buildWeightCard({
      ...base,
      logs: [{ week: 23, weight: 57 }, { week: 24, weight: 57.5 }],
    });
    expect(normal.state === "ready" && normal.fastGain).toBe(false);
  });

  it("มีบันทึกเดียวยังเทียบอัตราไม่ได้ ต้องไม่เตือน", () => {
    const v = buildWeightCard({ ...base, logs: [{ week: 24, weight: 70 }] });
    expect(v.state === "ready" && v.fastGain).toBe(false);
  });
});

/**
 * ขีดแกนตั้งของกราฟ
 *
 * แกนตั้งเป็น "น้ำหนักจริง" ไม่ใช่น้ำหนักที่เพิ่ม เพราะคนชั่งได้ 58.4 ตอนเช้า
 * ควรหาตัวเองบนกราฟเจอทันที ไม่ต้องคิดในใจว่า 0 คือน้ำหนักก่อนท้องของตัวเอง
 */
describe("ขีดแกนตั้งของกราฟน้ำหนัก", () => {
  it("เป็นน้ำหนักจริง ไม่ใช่น้ำหนักที่เพิ่ม", () => {
    // ก่อนท้อง 52 กก. · สเกลที่การ์ดใช้ตอนอายุครรภ์ 24 สัปดาห์ เกณฑ์ปกติ
    const ticks = weightAxisTicks(52, -0.5, 17);
    expect(ticks.map((t) => t.kg)).toEqual([52, 56, 60, 64, 68]);
    // gain คือตำแหน่งบนแกนเดียวกับ WeightPoint.gain จึงวาดด้วย yOf ตัวเดิมได้
    expect(ticks.map((t) => t.gain)).toEqual([0, 4, 8, 12, 16]);
  });

  it("เกาะเลขกลมๆ ไม่ใช่หารช่วงเท่าๆ กัน — ป้าย 51.5/55.0/58.5 อ่านไม่ออก", () => {
    for (const base of [48, 52.4, 61.7, 80, 95.5]) {
      // ช่วงแคบ (1.8 กก.) ด้วย ไม่งั้นขั้นจะเล็กกว่า 1 แล้วป้ายกลายเป็น 52.4/52.8
      for (const maxGain of [1.3, 17]) {
        const ticks = weightAxisTicks(base, -0.5, maxGain);
        expect(ticks.every((t) => Number.isInteger(t.kg))).toBe(true);
      }
    }
  });

  it("ไม่แน่นจนป้ายทับกัน และไม่โหรงเหรงจนอ่านค่าไม่ได้", () => {
    // ครบทุกกลุ่ม BMI: อ้วนเพิ่มน้อยสุด (9) ต่ำกว่าเกณฑ์เพิ่มมากสุด (18)
    for (const maxGain of [6, 10, 12, 17, 19]) {
      const n = weightAxisTicks(60, -0.5, maxGain).length;
      expect(n).toBeGreaterThanOrEqual(4);
      expect(n).toBeLessThanOrEqual(6);
    }
  });

  /** คนที่กรอกน้ำหนักผิดเป็นหลักร้อยไม่ควรทำให้แกนมีขีดเป็นสิบๆ ขีด */
  it("ช่วงกว้างผิดปกติก็ยังมีขีดไม่กี่ขีด", () => {
    expect(weightAxisTicks(52, -0.5, 98).length).toBeLessThanOrEqual(6);
  });

  it("ช่วงพังก็คืนค่าว่าง ไม่ใช่วนไม่จบ", () => {
    expect(weightAxisTicks(52, 0, 0)).toEqual([]);
    expect(weightAxisTicks(52, 5, 1)).toEqual([]);
  });
});
