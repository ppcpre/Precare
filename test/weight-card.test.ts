import { describe, expect, it } from "vitest";
import { assessGain } from "@/lib/weight-gain";
import {
  buildWeightCard,
  gainTone,
  weightAxisTicks,
  type WeightLogInput,
} from "@/lib/weight-card";

/**
 * บันทึกหนึ่งครั้ง — วันที่คิดจาก lmp + สัปดาห์ ให้ตรงกับความจริงพอประมาณ
 * เทสต์ไหนที่สนใจ "ชั่งวันไหนของสัปดาห์" ส่ง date/created มาเองได้
 */
const log = (
  week: number,
  weight: number | null,
  logDate = `2026-${String(4 + Math.floor(week / 4)).padStart(2, "0")}-01`,
  createdAt = `${logDate}T08:00:00.000Z`,
): WeightLogInput => ({ week, weight, logDate, createdAt });

const base = {
  lmpDate: "2026-04-01",
  heightCm: 160,
  prePregnancyWeight: 52,
  logs: [] as WeightLogInput[],
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
    const v = buildWeightCard({ ...base, logs: [log(10, null)] });
    expect(v).toMatchObject({ state: "need_log", bmi: 20.3, band: "normal" });
  });

  it("คิดน้ำหนักที่เพิ่มจากก่อนตั้งครรภ์ ไม่ใช่จากครั้งแรกที่ชั่ง", () => {
    const v = buildWeightCard({
      ...base,
      logs: [log(12, 53), log(24, 58.4)],
    });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.points).toEqual([
      { week: 12, gain: 1 },
      { week: 24, gain: 6.4 },
    ]);
  });

  it("เทียบกับเกณฑ์ของสัปดาห์ล่าสุด ไม่ใช่สัปดาห์อื่น", () => {
    const v = buildWeightCard({ ...base, logs: [log(24, 58.4)] });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.current.week).toBe(24);
    expect(v.assessment.status).toBe("within");
  });

  it("บันทึกไม่เรียงลำดับก็ต้องได้จุดล่าสุดถูกต้อง", () => {
    const v = buildWeightCard({
      ...base,
      logs: [log(24, 58.4), log(12, 53), log(20, 56)],
    });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.points.map((p) => p.week)).toEqual([12, 20, 24]);
    expect(v.current.week).toBe(24);
  });

  it("น้ำหนักลดในไตรมาสแรกต้องแสดงได้ ไม่ใช่พังหรือปัดเป็นศูนย์", () => {
    const v = buildWeightCard({ ...base, logs: [log(8, 50.5)] });
    if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
    expect(v.current.gain).toBe(-1.5);
    expect(v.assessment.status).toBe("below");
  });

  it("ขึ้นเร็วผิดปกติระหว่างสองครั้งล่าสุด", () => {
    const fast = buildWeightCard({
      ...base,
      logs: [log(23, 57), log(24, 58.4)],
    });
    expect(fast.state === "ready" && fast.fastGain).toBe(true);

    const normal = buildWeightCard({
      ...base,
      logs: [log(23, 57), log(24, 57.5)],
    });
    expect(normal.state === "ready" && normal.fastGain).toBe(false);
  });

  /**
   * ชั่งสองครั้งในสัปดาห์เดียวเป็นเรื่องปกติ — ชั่งวันจันทร์ แล้วไปฝากครรภ์
   * วันศุกร์ก็ชั่งอีก หรือวันไหนที่บวมแล้วอยากเช็ค การ์ดต้องตัดสินจาก
   * **ครั้งล่าสุด** ไม่ใช่ครั้งที่เผอิญอยู่ท้ายอาร์เรย์
   *
   * คิวรีส่งมาเรียงใหม่ไปเก่า เทสต์พวกนี้จึงส่งแบบเดียวกับของจริง
   */
  describe("ชั่งหลายครั้งในสัปดาห์เดียว", () => {
    const twice = [
      log(24, 59.8, "2026-10-09"), // ศุกร์ — ครั้งล่าสุด
      log(24, 58.4, "2026-10-05"), // จันทร์
    ];

    it("ตัดสินจากครั้งล่าสุด ไม่ใช่ครั้งแรกของสัปดาห์", () => {
      const v = buildWeightCard({ ...base, logs: twice });
      if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
      expect(v.current.gain).toBe(7.8);
    });

    it("กราฟเหลือสัปดาห์ละจุด ไม่ใช่เส้นตั้งฉากกลางกราฟ", () => {
      const v = buildWeightCard({
        ...base,
        logs: [...twice, log(20, 56, "2026-09-07")],
      });
      if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
      expect(v.points).toEqual([
        { week: 20, gain: 4 },
        { week: 24, gain: 7.8 },
      ]);
    });

    /** สลับลำดับที่ส่งเข้ามาด้วย ไม่งั้นเทสต์ผ่านเพราะบังเอิญหยิบตัวแรกถูก */
    it("ชั่งสองครั้งในวันเดียวกัน ตัดสินด้วยเวลาที่บันทึก", () => {
      const เช้า = log(24, 58.4, "2026-10-09", "2026-10-09T07:00:00.000Z");
      const เย็น = log(24, 59.8, "2026-10-09", "2026-10-09T19:00:00.000Z");

      for (const logs of [
        [เย็น, เช้า],
        [เช้า, เย็น],
      ]) {
        const v = buildWeightCard({ ...base, logs });
        if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
        expect(v.current.gain).toBe(7.8);
      }
    });

    /** บันทึกความดัน/อาการโดยไม่ชั่ง ต้องไม่ลบน้ำหนักของสัปดาห์นั้นทิ้ง */
    it("บันทึกทีหลังที่ไม่มีน้ำหนัก ไม่กลบน้ำหนักที่ชั่งไว้แล้ว", () => {
      const v = buildWeightCard({
        ...base,
        logs: [log(24, null, "2026-10-10"), log(24, 58.4, "2026-10-05")],
      });
      if (v.state !== "ready") throw new Error("ควรพร้อมแสดง");
      expect(v.current.gain).toBe(6.4);
    });

    /**
     * สัญญาณขึ้นเร็วผูกกับครรภ์เป็นพิษ เตือนผิดคือทำให้คนท้องตกใจฟรี —
     * ถ้าไปเทียบกับค่าที่เก่ากว่าในสัปดาห์เดียวกัน ส่วนต่างจะใหญ่เกินจริง
     */
    it("ไม่เตือนขึ้นเร็วเพราะไปเทียบกับค่าเก่าในสัปดาห์เดียวกัน", () => {
      const v = buildWeightCard({
        ...base,
        logs: [
          log(25, 60.3, "2026-10-12"),
          log(24, 59.8, "2026-10-09"), // ครั้งล่าสุดของสัปดาห์ 24 — ห่างแค่ 0.5
          log(24, 58.4, "2026-10-05"), // ถ้าไปเทียบตัวนี้จะกลายเป็น 1.9
        ],
      });
      expect(v.state === "ready" && v.fastGain).toBe(false);
    });
  });

  it("มีบันทึกเดียวยังเทียบอัตราไม่ได้ ต้องไม่เตือน", () => {
    const v = buildWeightCard({ ...base, logs: [log(24, 70)] });
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

/**
 * ถ้อยคำของแถบสรุป
 *
 * คำว่า "สูงกว่าช่วงที่คาดไว้" อ่านเหมือนตัดสินว่าตัวเองหนักเกิน ทั้งที่สิ่งที่
 * วัดคือจังหวะการขึ้นเทียบกับตาราง และคนที่เกิน 0.2 กก. ไม่ควรได้ข้อความ
 * เดียวกับคนที่เกิน 3 กก. — คนท้องอ่านแล้วตกใจง่าย
 */
describe("ถ้อยคำของแถบสรุปน้ำหนัก", () => {
  const tone = (gain: number, band: "normal" | "obese" = "normal") =>
    gainTone(assessGain(gain, band, { min: 4.4, max: 7.5 }));

  it("อยู่ในช่วง = ไม่ต้องอธิบายอะไรเพิ่ม", () => {
    expect(tone(6.4)).toEqual({ kind: "within", text: "อยู่ในช่วงที่คาดไว้", note: null });
  });

  it("เกินนิดเดียว บอกเป็นกิโลว่าห่างแค่ไหน และไม่ใช้คำว่าสูงกว่าเกณฑ์", () => {
    const t = tone(7.8);
    expect(t.kind).toBe("slight");
    expect(t.text).toContain("0.3");
    expect(t.text).not.toContain("สูงกว่า");
    // ต้องบอกด้วยว่าทำไมถึงไม่ต้องตกใจ ไม่ใช่แค่ลดระดับคำแล้วเงียบ
    expect(t.note).toBeTruthy();
  });

  it("เกินจริงจัง ชวนไปคุยกับหมอ ไม่ใช่ชวนให้คุมอาหารเอง", () => {
    const t = tone(10.5);
    expect(t.kind).toBe("off");
    expect(t.text).toContain("3");
    expect(t.note).toContain("หมอ");
    expect(t.note).not.toMatch(/ลดน้ำหนัก|คุมอาหาร|งดของหวาน/);
  });

  /** ขึ้นช้ากว่าก็มีความเสี่ยงของมัน ต้องไม่หายไปเงียบๆ และต้องไม่ดุกว่ากัน */
  it("ขึ้นช้ากว่าได้ถ้อยคำคู่ขนานกับขึ้นเร็วกว่า", () => {
    expect(tone(3.9).kind).toBe("slight");
    expect(tone(1.0).kind).toBe("off");
    expect(tone(1.0).note).toContain("หมอ");
  });

  it("เส้นแบ่งขยับตามกลุ่ม BMI", () => {
    expect(tone(7.8, "obese").kind).toBe("off"); // เกิน 0.3 > 0.27 กก./สัปดาห์
    expect(tone(7.8, "normal").kind).toBe("slight"); // เกิน 0.3 < 0.5
  });
});
