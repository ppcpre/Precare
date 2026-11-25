/**
 * บันทึกประจำวันลูก — ตัวเลขที่พ่อแม่เอาไปตอบพยาบาลตอนไปตรวจ
 * ผิดทีเดียวคือคนไม่เชื่อทั้งหน้า
 */
import { describe, expect, it } from "vitest";
import {
  addSeconds,
  breastTotals,
  clockSec,
  durationSec,
  latestByKind,
  nextSide,
  secondsBetween,
  sinceAnchor,
  spanLabel,
  stripMarks,
  summarizeDay,
  type BabyLogView,
} from "@/lib/baby-log";

const row = (p: Partial<BabyLogView>): BabyLogView => ({
  id: crypto.randomUUID(),
  childId: "c1",
  kind: "diaper",
  startedAt: "2026-11-22T10:00:00",
  endedAt: "2026-11-22T10:00:00",
  leftSec: null,
  rightSec: null,
  side: null,
  sideStartedAt: null,
  ml: null,
  milk: null,
  leftMl: null,
  rightMl: null,
  diaper: null,
  note: null,
  createdBy: "u1",
  createdByName: null,
  ...p,
});

describe("เวลา", () => {
  it("ลบเวลาข้ามเที่ยงคืนได้ และไม่ติดลบ", () => {
    expect(secondsBetween("2026-11-22T23:50:00", "2026-11-23T00:10:00")).toBe(1200);
    expect(secondsBetween("2026-11-22T10:00:05", "2026-11-22T10:00:00")).toBe(0);
    expect(addSeconds("2026-11-22T23:59:30", 60)).toBe("2026-11-23T00:00:30");
  });

  it("รูปแบบนาฬิกาและช่วงเวลา", () => {
    expect(clockSec(522)).toBe("08:42");
    expect(clockSec(5412)).toBe("1:30:12");
    expect(spanLabel(30)).toBe("ไม่ถึงนาที");
    expect(spanLabel(35 * 60)).toBe("35 น.");
    expect(spanLabel(2 * 3600)).toBe("2 ชม.");
    expect(spanLabel(4 * 3600 + 50 * 60 + 59)).toBe("4 ชม. 50 น.");
  });
});

describe("เต้า", () => {
  it("รวมช่วงที่กำลังจับอยู่เข้ากับข้างที่เปิดอยู่เท่านั้น", () => {
    const r = row({
      kind: "breast",
      endedAt: null,
      leftSec: 300,
      rightSec: 0,
      side: "right",
      sideStartedAt: "2026-11-22T10:10:00",
    });
    expect(breastTotals(r, "2026-11-22T10:12:00")).toEqual({ left: 300, right: 120 });
    expect(durationSec(r, "2026-11-22T10:12:00")).toBe(420);
  });

  it("หยุดพักอยู่ (sideStartedAt = null) ไม่นับเวลาเพิ่ม", () => {
    const r = row({ kind: "breast", endedAt: null, leftSec: 300, side: "left", sideStartedAt: null });
    expect(breastTotals(r, "2026-11-22T11:00:00")).toEqual({ left: 300, right: 0 });
  });

  it("จบแล้วไม่นับต่อ แม้ sideStartedAt ค้าง", () => {
    const r = row({
      kind: "breast",
      endedAt: "2026-11-22T10:20:00",
      leftSec: 600,
      side: "left",
      sideStartedAt: "2026-11-22T10:10:00",
    });
    expect(breastTotals(r, "2026-11-22T12:00:00").left).toBe(600);
  });

  it("ข้างถัดไปคืออีกข้างของครั้งล่าสุด", () => {
    expect(nextSide({ side: "right" })).toBe("left");
    expect(nextSide({ side: "left" })).toBe("right");
    expect(nextSide(null)).toBeNull();
  });
});

describe("ครั้งล่าสุด", () => {
  it("เลือกตามเวลาเริ่ม ไม่ใช่ลำดับในอาร์เรย์", () => {
    const a = row({ kind: "diaper", startedAt: "2026-11-22T12:00:00" });
    const b = row({ kind: "diaper", startedAt: "2026-11-22T09:00:00" });
    expect(latestByKind([b, a]).diaper?.id).toBe(a.id);
  });

  it("นอนนับจากตอนตื่น กินนับจากตอนเริ่ม", () => {
    const sleep = row({ kind: "sleep", startedAt: "2026-11-22T09:00:00", endedAt: "2026-11-22T11:00:00" });
    const feed = row({ kind: "bottle", startedAt: "2026-11-22T09:00:00", endedAt: "2026-11-22T09:00:00" });
    expect(sinceAnchor(sleep)).toBe("2026-11-22T11:00:00");
    expect(sinceAnchor(feed)).toBe("2026-11-22T09:00:00");
  });
});

describe("สรุปวัน", () => {
  const day = "2026-11-22";
  const now = "2026-11-22T14:00:00";

  it("ผ้าอ้อมทั้งคู่นับทั้งฉี่และอึ แต่เป็นผืนเดียว", () => {
    const s = summarizeDay(
      [row({ diaper: "wet" }), row({ diaper: "both" }), row({ diaper: "dirty" })],
      day,
      now,
    );
    expect(s.diaper).toEqual({ count: 3, wet: 2, dirty: 2 });
  });

  it("นอนข้ามเที่ยงคืนตัดตามวัน และนับรอบที่ยังนอนอยู่", () => {
    const rows = [
      row({ kind: "sleep", startedAt: "2026-11-21T23:00:00", endedAt: "2026-11-22T02:00:00" }),
      row({ kind: "sleep", startedAt: "2026-11-22T13:00:00", endedAt: null }),
    ];
    const s = summarizeDay(rows, day, now);
    expect(s.sleep.sec).toBe(2 * 3600 + 3600);
    expect(s.sleep.count).toBe(1);
    expect(s.sleep.running).toBe(true);
  });

  it("รายการของวันอื่นไม่ปนเข้ามา", () => {
    const s = summarizeDay(
      [row({ kind: "bottle", ml: 90, milk: "breast", startedAt: "2026-11-21T22:00:00" })],
      day,
      now,
    );
    expect(s.bottle.count).toBe(0);
  });

  it("ขวดกับปั๊มรวมปริมาณ", () => {
    const s = summarizeDay(
      [
        row({ kind: "bottle", ml: 60, milk: "breast" }),
        row({ kind: "bottle", ml: 30, milk: "formula" }),
        row({ kind: "pump", childId: null, leftMl: 80, rightMl: 100 }),
      ],
      day,
      now,
    );
    expect(s.bottle).toEqual({ count: 2, ml: 90, milks: ["breast", "formula"] });
    expect(s.pump).toEqual({ count: 1, ml: 180, left: 80, right: 100 });
  });
});

describe("แถบ 24 ชั่วโมง", () => {
  it("ตัดส่วนก่อนเที่ยงคืนทิ้ง และไม่ใส่อาบน้ำ", () => {
    const marks = stripMarks(
      [
        row({ kind: "sleep", startedAt: "2026-11-21T23:00:00", endedAt: "2026-11-22T02:00:00" }),
        row({ kind: "bath", startedAt: "2026-11-22T09:00:00", endedAt: "2026-11-22T09:00:00" }),
        row({
          kind: "diaper",
          diaper: "wet",
          startedAt: "2026-11-22T06:30:00",
          endedAt: "2026-11-22T06:30:00",
        }),
      ],
      "2026-11-22",
      "2026-11-22T14:00:00",
    );
    expect(marks.map((m) => [m.lane, m.from, m.to])).toEqual([
      ["sleep", 0, 120],
      ["diaper", 390, 390],
    ]);
  });
});
