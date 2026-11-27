import { describe, expect, it } from "vitest";
import {
  RULE,
  START_WEEK,
  checkRule,
  clock,
  durationOf,
  gapOf,
  parseContractions,
  seconds,
  toLaborView,
} from "@/lib/labor";

/** สร้างชุดการบีบที่ห่างเท่ากันและนานเท่ากัน — ใช้เป็นฐานของเกือบทุกเทสต์ */
function series(count: number, gapMin: number, durSec: number, start = "2026-09-08T20:00:00") {
  const base = new Date(start).getTime();
  return Array.from({ length: count }, (_, i) => {
    const at = new Date(base + i * gapMin * 60_000);
    const to = new Date(at.getTime() + durSec * 1000);
    return { at: iso(at), to: iso(to) };
  });
}
const iso = (d: Date) =>
  `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
const p = (n: number) => String(n).padStart(2, "0");

describe("parseContractions", () => {
  it("อ่านคู่เริ่ม-จบ และรับ to ที่ยังว่างได้", () => {
    const list = parseContractions('[{"at":"2026-09-08T20:00:00","to":"2026-09-08T20:01:00"},{"at":"2026-09-08T20:05:00","to":null}]');
    expect(list).toHaveLength(2);
    expect(list[1].to).toBeNull();
  });

  /** หน้านี้ถูกเปิดตอนเจ็บท้อง แถวที่ JSON พังต้องไม่ทำให้ทั้งหน้าล่ม */
  it("JSON พังต้องคืนรายการว่าง ไม่ใช่โยน error", () => {
    expect(parseContractions("{ไม่ใช่ json")).toEqual([]);
    expect(parseContractions('"ไม่ใช่ array"')).toEqual([]);
  });
});

describe("ระยะห่างและความนาน", () => {
  it("ระยะห่างวัดจากเริ่มถึงเริ่ม ตามที่ตำราใช้ ไม่ใช่จากคลายถึงเริ่ม", () => {
    const [a, b] = series(2, 5, 60);
    // ถ้าวัดจากคลายถึงเริ่มจะได้ 4 นาที ซึ่งทำให้เข้าเกณฑ์ทั้งที่ไม่ควร
    expect(gapOf(a, b)).toBe(5 * 60_000);
  });

  it("ครั้งที่ยังบีบอยู่ยังไม่มีความนาน", () => {
    expect(durationOf({ at: "2026-09-08T20:00:00", to: null })).toBeNull();
  });
});

describe("เกณฑ์ 5-1-1", () => {
  it("ครบทั้งสามข้อจึงจะเข้าเกณฑ์", () => {
    // ห่าง 4 นาที นาน 70 วินาที ต่อเนื่อง 68 นาที (18 ครั้ง)
    const r = checkRule(series(18, 4, 70));
    expect(r.gapOk).toBe(true);
    expect(r.durationOk).toBe(true);
    expect(r.sustainedOk).toBe(true);
    expect(r.met).toBe(true);
  });

  it("ถี่และนานพอ แต่ยังไม่ครบชั่วโมง ต้องยังไม่เข้าเกณฑ์", () => {
    // 8 ครั้ง ห่าง 4 นาที = ต่อเนื่องแค่ 28 นาที
    const r = checkRule(series(8, 4, 70));
    expect(r.gapOk).toBe(true);
    expect(r.durationOk).toBe(true);
    expect(r.sustainedOk).toBe(false);
    expect(r.met).toBe(false);
  });

  it("นานพอและครบชั่วโมง แต่ห่างเกิน ต้องยังไม่เข้าเกณฑ์", () => {
    const r = checkRule(series(10, 8, 70));
    expect(r.gapOk).toBe(false);
    expect(r.met).toBe(false);
  });

  it("ถี่และครบชั่วโมง แต่บีบสั้นเกิน ต้องยังไม่เข้าเกณฑ์", () => {
    const r = checkRule(series(18, 4, 30));
    expect(r.durationOk).toBe(false);
    expect(r.met).toBe(false);
  });

  /**
   * ใช้ค่าเฉลี่ย ไม่ใช่ครั้งล่าสุดครั้งเดียว
   * ครั้งเดียวที่ห่างผิดจังหวะไม่ควรพลิกผลทั้งรอบ ทั้งขาเข้าและขาออก
   */
  it("ครั้งเดียวที่ห่างผิดจังหวะต้องไม่พลิกผล", () => {
    const list = series(18, 4, 70);
    // ดันครั้งสุดท้ายให้ห่างออกไป 9 นาที
    const last = new Date(new Date(list[16].at).getTime() + 9 * 60_000);
    list[17] = { at: iso(last), to: iso(new Date(last.getTime() + 70_000)) };
    expect(checkRule(list).met).toBe(true);
  });

  it("ครั้งที่ยังบีบอยู่ไม่ถูกนับ", () => {
    const list = [...series(18, 4, 70), { at: "2026-09-08T22:00:00", to: null }];
    const r = checkRule(list);
    // ครั้งที่ยังไม่จบไม่มีความนาน ถ้าเผลอนับจะดึงค่าเฉลี่ยลงจนหลุดเกณฑ์
    expect(r.durationOk).toBe(true);
  });

  it("ยังไม่มีข้อมูลต้องไม่เข้าเกณฑ์และไม่พัง", () => {
    const r = checkRule([]);
    expect(r.met).toBe(false);
    expect(r.avgGapMs).toBeNull();
  });
});

describe("การแสดงผล", () => {
  it("clock อ่านเป็น นาที:วินาที", () => {
    expect(clock(4 * 60_000 + 10_000)).toBe("4:10");
    expect(clock(9_000)).toBe("0:09");
  });

  it("ความนานต่ำกว่านาทีอ่านเป็นวินาทีล้วน", () => {
    expect(seconds(52_000)).toBe("52 วิ");
    expect(seconds(65_000)).toBe("1:05");
  });
});

describe("toLaborView", () => {
  it("แยกครั้งที่กำลังบีบอยู่ออกจากจำนวนที่บันทึกแล้ว", () => {
    const v = toLaborView({
      id: "s1",
      startedAt: "2026-09-08T20:00:00",
      endedAt: null,
      events: JSON.stringify([...series(3, 4, 60), { at: "2026-09-08T20:12:00", to: null }]),
    });
    expect(v.count).toBe(3);
    expect(v.ongoing?.at).toBe("2026-09-08T20:12:00");
    expect(v.durationMs).toBeNull();
  });
});

describe("ค่าคงที่", () => {
  it("เปิดใช้ตั้งแต่สัปดาห์ 36 และเกณฑ์เป็น 5-1-1", () => {
    expect(START_WEEK).toBe(36);
    expect(RULE.maxGapMinutes).toBe(5);
    expect(RULE.minDurationSeconds).toBe(60);
    expect(RULE.sustainedMinutes).toBe(60);
  });
});
