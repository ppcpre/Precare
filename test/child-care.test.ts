/**
 * ยาของลูก (กันให้ซ้ำ) และการ์ดไข้ของลูกวัยแรกเกิด
 *
 * ให้ยาลดไข้ซ้ำเพราะพ่อกับแม่ไม่รู้ว่าอีกคนเพิ่งให้ คือเหตุผลเดียวที่หน้านี้มี
 * ส่วนการ์ดไข้ต้องยกข้อความจากหน้าอาการคำต่อคำ ห้ามมีฉบับที่สอง
 */
import { describe, expect, it } from "vitest";
import { doseWarning, parseTimes, ruleLabel, type DoseView } from "@/lib/child-meds";
import { isYoungInfant, newbornSection, newbornSignTable, newbornSignsFor } from "@/lib/child-temp";

const dose = (givenAt: string, givenBy = "u2"): DoseView => ({
  id: crypto.randomUUID(),
  givenAt,
  givenBy,
  givenByName: "พ่อ",
});

describe("กันให้ยาซ้ำ", () => {
  const prn = { mode: "prn" as const, minGapMin: 240, times: null };

  it("ยาตามอาการ: ยังไม่ถึงช่วงห่างที่ตั้งไว้ = ถามก่อน พร้อมข้อเท็จจริง", () => {
    const w = doseWarning(prn, [dose("2026-11-22T13:55:00")], "2026-11-22T14:35:00");
    expect(w).toMatchObject({ gapMin: 240, sinceSec: 40 * 60 });
    expect(w?.last.givenByName).toBe("พ่อ");
  });

  it("ยาตามอาการ: ครบช่วงห่างแล้ว หรือยังไม่เคยให้ = ไม่ถาม", () => {
    expect(doseWarning(prn, [dose("2026-11-22T10:15:00")], "2026-11-22T14:35:00")).toBeNull();
    expect(doseWarning(prn, [], "2026-11-22T14:35:00")).toBeNull();
  });

  it("ยาประจำ: วันนี้ให้ครบตามจำนวนเวลาแล้ว = ถาม · เมื่อวานไม่นับ", () => {
    const daily = { mode: "daily" as const, minGapMin: null, times: "09:00,21:00" };
    const now = "2026-11-22T21:30:00";
    expect(doseWarning(daily, [dose("2026-11-22T09:05:00")], now)).toBeNull();
    expect(
      doseWarning(daily, [dose("2026-11-22T21:00:00"), dose("2026-11-22T09:05:00")], now),
    ).toMatchObject({ today: { given: 2, planned: 2 } });
    expect(doseWarning(daily, [dose("2026-11-21T21:00:00"), dose("2026-11-21T09:00:00")], now)).toBeNull();
  });

  it("ป้ายวิธีให้ยา", () => {
    expect(parseTimes("21:00, 09:00,xx")).toEqual(["09:00", "21:00"]);
    expect(ruleLabel({ ...prn, dose: "1.2 มล." })).toBe("ครั้งละ 1.2 มล. · ให้ตามอาการ · ห่างกันอย่างน้อย 4 ชม.");
    expect(ruleLabel({ mode: "daily", minGapMin: null, times: "09:00", dose: null })).toBe("วันละครั้ง · 09:00");
  });
});

describe("การ์ดไข้ลูกวัยแรกเกิด", () => {
  it("อายุตามขอบของหมวดในหน้าอาการ (2 เดือน)", () => {
    expect(isYoungInfant("2026-10-01", "2026-11-30")).toBe(true);
    expect(isYoungInfant("2026-10-01", "2026-12-01")).toBe(false);
  });

  it("ยกข้อความจากหน้าอาการ ไม่แต่งเอง", () => {
    const labels = newbornSection().signs.map((s) => s.label);
    const picked = newbornSignsFor(["ดูดนมน้อยลง", "ผื่น"]);
    expect(picked.length).toBe(2); // ตัวร้อน + ดูดนม · ผื่นไม่มีในหมวดนี้ จึงไม่ยกมา
    for (const p of picked) expect(labels).toContain(p);

    const t = newbornSignTable();
    expect(t.base).toHaveLength(1);
    for (const v of [...t.base, ...Object.values(t.bySymptom)]) expect(labels).toContain(v);
  });
});
