/**
 * การคำนวณสรุปค่าใช้จ่าย
 *
 * จุดที่พลาดง่ายที่สุดคือความต่างระหว่าง null (ยังไม่ได้ระบุ) กับ 0
 * (ไปมาแล้วไม่เสียเงิน) ถ้าปนกันเมื่อไหร่ ยอดรวมกับค่าเฉลี่ยจะผิดทันที
 */
import { describe, expect, it } from "vitest";
import { byGroup, byMonth, estimateRemaining, totalsOf, type CostItem } from "@/lib/costs";

let n = 0;
const item = (p: Partial<CostItem> = {}): CostItem => ({
  id: `a${n++}`,
  apptDatetime: "2026-08-12T09:00:00",
  title: "ตรวจครรภ์",
  location: null,
  groupId: "g1",
  groupName: "ฝากครรภ์",
  groupColor: "peach",
  costSatang: 120000,
  claimStatus: "none",
  ...p,
});

describe("totalsOf()", () => {
  it("นับเฉพาะนัดที่ระบุแล้ว และรายงานจำนวนที่ยังไม่ระบุ", () => {
    const t = totalsOf([
      item({ costSatang: 120000 }),
      item({ costSatang: 80000 }),
      item({ costSatang: null }),
      item({ costSatang: null }),
    ]);
    expect(t.totalSatang).toBe(200000);
    expect(t.counted).toBe(2);
    expect(t.missing).toBe(2);
  });

  it("0 คือระบุแล้วว่าไม่เสียเงิน ไม่ใช่ยังไม่ระบุ", () => {
    const t = totalsOf([item({ costSatang: 0 }), item({ costSatang: null })]);
    expect(t.counted, "0 ต้องถูกนับ").toBe(1);
    expect(t.missing, "null เท่านั้นที่ไม่ถูกนับ").toBe(1);
    expect(t.totalSatang).toBe(0);
    // เฉลี่ยจาก 1 นัดที่ระบุว่า 0 บาท = 0 ไม่ใช่ null
    expect(t.avgSatang).toBe(0);
  });

  it("เฉลี่ยเป็น null เมื่อยังไม่มีนัดไหนระบุ ไม่ใช่ 0", () => {
    // ถ้าคืน 0 จะไปโชว์ว่า "เฉลี่ยต่อนัด ฿0" ทั้งที่ยังไม่มีข้อมูลเลย
    expect(totalsOf([item({ costSatang: null })]).avgSatang).toBeNull();
    expect(totalsOf([]).avgSatang).toBeNull();
  });

  it("เบิกไม่ได้ ไม่นับเป็นยอดที่เบิกได้ ส่วนเบิกแล้วนับทั้งสองช่อง", () => {
    const t = totalsOf([
      item({ costSatang: 100000, claimStatus: "done" }),
      item({ costSatang: 50000, claimStatus: "none" }),
      item({ costSatang: 30000, claimStatus: "no" }),
    ]);
    expect(t.totalSatang).toBe(180000);
    expect(t.claimableSatang).toBe(150000);
    expect(t.claimedSatang).toBe(100000);
  });
});

describe("byMonth()", () => {
  it("จัดกลุ่มตามเดือนและเรียงเก่าไปใหม่", () => {
    const buckets = byMonth([
      item({ apptDatetime: "2026-09-02T09:00:00" }),
      item({ apptDatetime: "2026-07-13T09:00:00" }),
      item({ apptDatetime: "2026-08-12T09:00:00" }),
      item({ apptDatetime: "2026-08-26T09:00:00" }),
    ]);
    expect(buckets.map((b) => b.key)).toEqual(["2026-07", "2026-08", "2026-09"]);
    expect(buckets[1].items).toHaveLength(2);
  });

  it("ตัดเดือนจากสตริงตรงๆ ไม่ผ่าน Date จึงไม่เพี้ยนเพราะ timezone", () => {
    // เที่ยงคืนวันที่ 1 ถ้าแปลงเป็น Date ใน timezone ลบ จะกลายเป็นเดือนก่อนหน้า
    const b = byMonth([item({ apptDatetime: "2026-08-01T00:00:00" })]);
    expect(b[0].key).toBe("2026-08");
  });
});

describe("byGroup()", () => {
  it("เรียงจากยอดมากไปน้อย", () => {
    const buckets = byGroup([
      item({ groupId: "g1", groupName: "ฝากครรภ์", costSatang: 100000 }),
      item({ groupId: "g2", groupName: "ทันตกรรม", costSatang: 350000 }),
    ]);
    expect(buckets.map((b) => b.name)).toEqual(["ทันตกรรม", "ฝากครรภ์"]);
  });

  it("นัดที่ไม่มีกลุ่มรวมกันเป็น ทั่วไป", () => {
    const buckets = byGroup([
      item({ groupId: null, groupName: null, groupColor: null, costSatang: 10000 }),
      item({ groupId: null, groupName: null, groupColor: null, costSatang: 20000 }),
    ]);
    expect(buckets).toHaveLength(1);
    expect(buckets[0].name).toBe("ทั่วไป");
    expect(buckets[0].totals.totalSatang).toBe(30000);
  });
});

describe("estimateRemaining()", () => {
  const now = "2026-09-01T00:00:00";

  it("เฉลี่ยจากนัดที่ผ่านมา คูณจำนวนนัดข้างหน้าที่ยังไม่ระบุ", () => {
    const est = estimateRemaining(
      [
        item({ apptDatetime: "2026-07-13T09:00:00", costSatang: 100000 }),
        item({ apptDatetime: "2026-08-12T09:00:00", costSatang: 200000 }),
        item({ apptDatetime: "2026-09-16T09:00:00", costSatang: null }),
        item({ apptDatetime: "2026-10-16T09:00:00", costSatang: null }),
      ],
      now,
    );
    expect(est).toBe(150000 * 2);
  });

  it("นัดข้างหน้าที่ระบุแล้วไม่ถูกนับซ้ำในประมาณการ", () => {
    const est = estimateRemaining(
      [
        item({ apptDatetime: "2026-08-12T09:00:00", costSatang: 100000 }),
        item({ apptDatetime: "2026-09-16T09:00:00", costSatang: 500000 }),
        item({ apptDatetime: "2026-10-16T09:00:00", costSatang: null }),
      ],
      now,
    );
    expect(est).toBe(100000);
  });

  it("คืน null เมื่อยังประมาณไม่ได้", () => {
    // ไม่มีนัดที่ผ่านมาแล้วระบุไว้เลย
    expect(estimateRemaining([item({ apptDatetime: "2026-10-01T09:00:00" })], now)).toBeNull();
    // ไม่เหลือนัดข้างหน้าที่ยังไม่ระบุ
    expect(
      estimateRemaining([item({ apptDatetime: "2026-08-01T09:00:00", costSatang: 100000 })], now),
    ).toBeNull();
  });
});
