import { describe, expect, it } from "vitest";
import { buildWeightCard } from "@/lib/weight-card";

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
