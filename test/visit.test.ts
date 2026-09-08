import { describe, expect, it } from "vitest";
import { VISIT_RULES, buildVisitSummary } from "@/lib/visit";
import type { SessionView } from "@/lib/kicks";

const log = (
  logDate: string,
  o: Partial<{ weight: number; bpSystolic: number; bpDiastolic: number; symptoms: string }> = {},
) => ({
  logDate,
  weight: o.weight ?? null,
  bpSystolic: o.bpSystolic ?? null,
  bpDiastolic: o.bpDiastolic ?? null,
  symptoms: o.symptoms ?? null,
});

/**
 * ต้องใส่ count/target ให้ครบ — averageMs นับเฉพาะรอบที่ "ครบเป้า" เท่านั้น
 * (ลืมไปตอนแรก แล้วค่าเฉลี่ยออกมาเป็น null ทั้งที่มีข้อมูล)
 */
const session = (startedAt: string, durationMs: number | null): SessionView =>
  ({ id: startedAt, startedAt, durationMs, count: 10, target: 10 }) as SessionView;

const build = (o: Partial<Parameters<typeof buildVisitSummary>[0]> = {}) =>
  buildVisitSummary({ since: null, today: "2026-09-16", logs: [], sessions: [], ...o });

describe("ช่วงเวลา ตั้งแต่ครั้งที่แล้ว", () => {
  it("นับจำนวนวันจากนัดที่ผ่านมาล่าสุด", () => {
    const s = build({ since: "2026-08-19T09:30:00.000Z" });
    expect(s.daysSince).toBe(28);
  });

  it("ยังไม่เคยมีนัดที่ผ่านมา ต้องไม่พังและสรุปทั้งหมดที่มี", () => {
    const s = build({ logs: [log("2026-09-01", { weight: 60 })] });
    expect(s.since).toBeNull();
    expect(s.daysSince).toBeNull();
    expect(s.weight.latest?.weight).toBe(60);
  });
});

describe("น้ำหนัก", () => {
  const logs = [
    log("2026-04-01", { weight: 55.2 }),
    log("2026-08-19", { weight: 62.4 }),
    log("2026-09-12", { weight: 64.8 }),
  ];

  it("แยก จากครั้งที่แล้ว ออกจาก รวมทั้งครรภ์", () => {
    const s = build({ since: "2026-08-19", logs });
    expect(s.weight.sinceLast).toBe(2.4);
    expect(s.weight.total).toBe(9.6);
  });

  /** ทศนิยมลอยเป็นเรื่องปกติของ float — 64.8 - 62.4 ได้ 2.4000000000000057 */
  it("ปัดทศนิยมหนึ่งตำแหน่ง ไม่ปล่อยค่าดิบของ float ออกหน้าจอ", () => {
    const s = build({ since: "2026-08-19", logs });
    expect(String(s.weight.sinceLast)).toBe("2.4");
  });

  it("มีค่าเดียวก็ยังไม่มีส่วนต่างให้เทียบ", () => {
    const s = build({ logs: [log("2026-09-12", { weight: 64.8 })] });
    expect(s.weight.total).toBeNull();
  });
});

describe("สิ่งที่ควรบอกหมอ", () => {
  it("ความดันถึงเกณฑ์ต้องขึ้นเป็นอันดับแรกและเป็นระดับหนัก", () => {
    const s = build({
      logs: [log("2026-09-01", { bpSystolic: 118, bpDiastolic: 76 }),
             log("2026-09-12", { bpSystolic: 148, bpDiastolic: 92 })],
    });
    expect(s.flags[0].severity).toBe("bad");
    expect(s.flags[0].text).toContain("148/92");
  });

  /**
   * ข้อห้ามของฟีเจอร์นี้: ชี้ให้ดู ไม่ใช่วินิจฉัย
   * ถ้าวันหนึ่งมีใครเผลอเติมคำวินิจฉัยลงในข้อความ เทสต์นี้ต้องแดง
   */
  it("ห้ามมีคำที่เป็นการวินิจฉัยโรค", () => {
    const s = build({
      logs: [log("2026-09-12", { bpSystolic: 160, bpDiastolic: 100, weight: 70 })],
    });
    const all = s.flags.map((f) => f.text).join(" ");
    for (const banned of ["ครรภ์เป็นพิษ", "เสี่ยง", "อันตราย", "ผิดปกติร้ายแรง", "ควรรีบ"]) {
      expect(all).not.toContain(banned);
    }
  });

  it("น้ำหนักขึ้นเกินเกณฑ์ต่อสัปดาห์จึงจะเตือน", () => {
    const fast = build({
      since: "2026-08-29",
      logs: [log("2026-08-29", { weight: 60 }), log("2026-09-12", { weight: 63 })],
    });
    expect(fast.flags.some((f) => f.text.includes("น้ำหนัก"))).toBe(true);

    // 1 กก. ใน 2 สัปดาห์ = 0.5/สัปดาห์ อยู่ในเกณฑ์ปกติ ต้องไม่เตือน
    const normal = build({
      since: "2026-08-29",
      logs: [log("2026-08-29", { weight: 60 }), log("2026-09-12", { weight: 61 })],
    });
    expect(normal.flags.some((f) => f.text.includes("น้ำหนัก"))).toBe(false);
  });

  it("ลูกดิ้นช้าต้องมีรอบมากพอก่อน ไม่งั้นค่าเฉลี่ยไม่มีความหมาย", () => {
    // สองรอบ: ค่าเฉลี่ยมาจากตัวมันเองเกือบทั้งหมด เตือนไปก็ไม่ได้บอกอะไร
    const few = build({
      sessions: [session("2026-09-01", 10 * 60_000), session("2026-09-02", 60 * 60_000)],
    });
    expect(few.flags.some((f) => f.text.includes("ลูกดิ้น"))).toBe(false);

    const enough = build({
      sessions: [
        session("2026-09-01", 10 * 60_000),
        session("2026-09-02", 12 * 60_000),
        session("2026-09-03", 11 * 60_000),
        session("2026-09-04", 60 * 60_000),
      ],
    });
    expect(enough.flags.some((f) => f.text.includes("ลูกดิ้น"))).toBe(true);
  });

  it("ทุกอย่างปกติ ต้องไม่มีอะไรขึ้นเลย ไม่ใช่ขึ้นว่าปกติดี", () => {
    const s = build({
      since: "2026-08-29",
      logs: [log("2026-08-29", { weight: 60, bpSystolic: 112, bpDiastolic: 70 }),
             log("2026-09-12", { weight: 60.5, bpSystolic: 115, bpDiastolic: 72 })],
    });
    expect(s.flags).toHaveLength(0);
  });
});

describe("อาการ", () => {
  it("รวมอาการในช่วงและตัดที่ซ้ำออก", () => {
    const s = build({
      since: "2026-08-29",
      logs: [
        log("2026-08-01", { symptoms: '["คลื่นไส้"]' }),
        log("2026-09-01", { symptoms: '["บวมที่เท้า","ปวดหลัง"]' }),
        log("2026-09-10", { symptoms: '["ปวดหลัง"]' }),
      ],
    });
    expect(s.symptoms).toEqual(["บวมที่เท้า", "ปวดหลัง"]);
  });

  /** แถวที่ JSON เพี้ยนไม่ควรทำให้ทั้งหน้าล่ม — หน้านี้ถูกเปิดตอนอยู่หน้าหมอ */
  it("แถวที่ JSON พังต้องข้ามไป ไม่ใช่โยน error", () => {
    const s = build({ logs: [log("2026-09-01", { symptoms: "{ไม่ใช่ json" })] });
    expect(s.symptoms).toEqual([]);
  });
});

describe("ไม่มีข้อมูลเลย", () => {
  it("ต้องบอกว่าว่าง ไม่ใช่โชว์การ์ดที่มีแต่ขีด", () => {
    expect(build().empty).toBe(true);
    expect(build({ logs: [log("2026-09-01", { weight: 60 })] }).empty).toBe(false);
  });
});

describe("เกณฑ์", () => {
  /** เกณฑ์ทุกตัวต้องอยู่ที่เดียว วันหนึ่งหมอบอกให้แก้ จะได้แก้จุดเดียว */
  it("ประกาศไว้ครบและเป็นค่าที่ตั้งใจ", () => {
    expect(VISIT_RULES.weightKgPerWeek).toBe(1.0);
    expect(VISIT_RULES.kickSlowMultiplier).toBe(2);
    expect(VISIT_RULES.kickMinSessions).toBe(3);
    expect(VISIT_RULES.highBp(140, 85)).toBe(true);
    expect(VISIT_RULES.highBp(139, 89)).toBe(false);
  });
});
