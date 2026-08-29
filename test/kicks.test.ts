/**
 * นับลูกดิ้น — จุดที่พลาดแล้วอันตรายที่สุดในแอป
 * ตัวเลขที่ผิดอาจทำให้คนคิดว่าไม่ต้องไปหาหมอ
 */
import { describe, expect, it } from "vitest";
import {
  SLOW_MINUTES,
  averageMs,
  formatDuration,
  formatMinutes,
  isOverTimeLimit,
  isSlowVsAverage,
  localIso,
  parseEvents,
  toView,
  type SessionView,
} from "@/lib/kicks";

const session = (p: Partial<SessionView> = {}): SessionView => ({
  id: "s1",
  startedAt: "2026-08-28T20:00:00",
  endedAt: "2026-08-28T20:26:00",
  count: 10,
  target: 10,
  events: [],
  durationMs: 26 * 60_000,
  note: null,
  ...p,
});

describe("parseEvents()", () => {
  it("อ่าน JSON ปกติได้", () => {
    expect(parseEvents('[{"at":"2026-08-28T20:14:00"}]')).toHaveLength(1);
  });

  it("ข้อมูลเสียต้องไม่ทำให้ทั้งหน้าพัง", () => {
    // แถวเดียวที่เสียไม่ควรทำให้เปิดหน้าประวัติไม่ได้เลย
    for (const bad of ["", "not json", "{}", "null", "[1,2,3]", '[{"x":1}]']) {
      expect(parseEvents(bad), bad).toEqual([]);
    }
  });

  it("คัดเฉพาะรายการที่มี at เป็นสตริง", () => {
    expect(parseEvents('[{"at":"a"},{"at":5},{"nope":1}]')).toEqual([{ at: "a" }]);
  });
});

describe("localIso()", () => {
  it("เก็บเป็นเวลาท้องถิ่น ไม่ใช่ UTC", () => {
    const d = new Date(2026, 7, 28, 20, 14, 5);
    expect(localIso(d)).toBe("2026-08-28T20:14:05");
    // ถ้าเผลอใช้ toISOString จะได้เวลาที่ต่างไป 7 ชั่วโมงในไทย
    expect(localIso(d)).not.toContain("Z");
  });

  it("เติมศูนย์ครบทุกช่อง", () => {
    expect(localIso(new Date(2026, 0, 5, 9, 3, 7))).toBe("2026-01-05T09:03:07");
  });
});

describe("formatDuration()", () => {
  it("ไม่ใส่ชั่วโมงถ้ายังไม่ถึง", () => {
    expect(formatDuration(42_000)).toBe("0:42");
    expect(formatDuration(18 * 60_000 + 42_000)).toBe("18:42");
  });

  it("ใส่ชั่วโมงเมื่อเกิน", () => {
    expect(formatDuration(2 * 3600_000 + 4 * 60_000 + 10_000)).toBe("2:04:10");
  });

  it("ค่าติดลบไม่ทำให้เพี้ยน", () => {
    expect(formatDuration(0)).toBe("0:00");
  });
});

describe("formatMinutes()", () => {
  it("ต่ำกว่านาทีบอกตรงๆ ไม่ปัดเป็น 0 นาที", () => {
    // "0 นาที" อ่านแล้วเหมือนระบบพัง ทั้งที่แค่รอบสั้นมาก
    expect(formatMinutes(20_000)).toBe("ไม่ถึง 1 นาที");
    expect(formatMinutes(0)).toBe("ไม่ถึง 1 นาที");
    expect(formatMinutes(60_000)).toBe("1 นาที");
  });

  it("อ่านง่ายทั้งต่ำและเกินชั่วโมง", () => {
    expect(formatMinutes(26 * 60_000)).toBe("26 นาที");
    expect(formatMinutes(68 * 60_000)).toBe("1 ชม. 8 นาที");
    expect(formatMinutes(120 * 60_000)).toBe("2 ชม.");
  });
});

describe("isOverTimeLimit()", () => {
  it("ตัดที่ 2 ชั่วโมงพอดี", () => {
    expect(isOverTimeLimit((SLOW_MINUTES - 1) * 60_000)).toBe(false);
    expect(isOverTimeLimit(SLOW_MINUTES * 60_000)).toBe(true);
  });
});

describe("averageMs()", () => {
  it("นับเฉพาะรอบที่ครบเป้า", () => {
    const avg = averageMs([
      session({ durationMs: 20 * 60_000, count: 10 }),
      session({ durationMs: 30 * 60_000, count: 10 }),
      // รอบที่หยุดกลางคันเอามาเฉลี่ยไม่ได้ ไม่งั้นค่าเฉลี่ยจะดูดีเกินจริง
      session({ durationMs: 5 * 60_000, count: 3 }),
    ]);
    expect(avg).toBe(25 * 60_000);
  });

  it("คืน null เมื่อยังไม่มีรอบที่ครบ ไม่ใช่ 0", () => {
    expect(averageMs([])).toBeNull();
    expect(averageMs([session({ count: 4, durationMs: 60_000 })])).toBeNull();
    // 0 จะไปโชว์ว่า "เฉลี่ย 0 นาที" ทั้งที่ยังไม่มีข้อมูล
  });

  it("ไม่นับรอบที่ยังนับอยู่", () => {
    expect(averageMs([session({ durationMs: null, endedAt: null })])).toBeNull();
  });
});

describe("isSlowVsAverage()", () => {
  it("ช้ากว่าค่าเฉลี่ยตัวเอง 2 เท่าขึ้นไปถึงจะชี้ให้ดู", () => {
    const avg = 30 * 60_000;
    expect(isSlowVsAverage(session({ durationMs: 55 * 60_000 }), avg)).toBe(false);
    expect(isSlowVsAverage(session({ durationMs: 60 * 60_000 }), avg)).toBe(true);
  });

  it("ยังไม่มีค่าเฉลี่ยก็ยังไม่ชี้อะไร", () => {
    expect(isSlowVsAverage(session(), null)).toBe(false);
  });
});

describe("toView()", () => {
  it("นับจำนวนจาก events ไม่เก็บซ้ำเป็นคอลัมน์", () => {
    const v = toView({
      id: "s1",
      startedAt: "2026-08-28T20:00:00",
      endedAt: "2026-08-28T20:26:00",
      targetCount: 10,
      events: '[{"at":"2026-08-28T20:05:00"},{"at":"2026-08-28T20:09:00"}]',
      note: null,
    });
    expect(v.count).toBe(2);
    expect(v.durationMs).toBe(26 * 60_000);
  });

  it("รอบที่ยังนับอยู่ยังไม่มีระยะเวลา", () => {
    const v = toView({
      id: "s1",
      startedAt: "2026-08-28T20:00:00",
      endedAt: null,
      targetCount: 10,
      events: "[]",
      note: null,
    });
    expect(v.durationMs).toBeNull();
  });
});
