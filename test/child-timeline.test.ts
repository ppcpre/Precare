import { describe, expect, it } from "vitest";
import { buildTimeline, type TimelineItem } from "@/lib/child-timeline";
import { SLOT_COUNT } from "@/lib/child-age";

const BORN = "2026-03-10";

const item = (id: string, takenAt: string, pinned = false): TimelineItem => ({
  id,
  takenAt,
  thumbKey: null,
  r2Key: `k/${id}`,
  mediaKind: "photo",
  pinned,
});

describe("buildTimeline", () => {
  it("ไม่มีรูปเลยก็ยังคืนครบ 26 ช่อง — ช่องว่างคือตัวฟีเจอร์", () => {
    const t = buildTimeline(BORN, []);
    expect(t.slots).toHaveLength(SLOT_COUNT);
    expect(t.filled).toBe(0);
    expect(t.total).toBe(SLOT_COUNT);
    expect(t.slots.every((s) => s.cover === null)).toBe(true);
  });

  it("จัดรูปลงช่องตามวันถ่าย", () => {
    const t = buildTimeline(BORN, [
      item("a", "2026-03-12"), // สัปดาห์ที่ 1
      item("b", "2026-05-20"), // 2 เดือน
      item("c", "2027-03-15"), // 1 ขวบ
    ]);
    const by = Object.fromEntries(t.slots.map((s) => [s.id, s.items.map((i) => i.id)]));
    expect(by["w1"]).toEqual(["a"]);
    expect(by["m2"]).toEqual(["b"]);
    expect(by["q12"]).toEqual(["c"]);
    expect(t.filled).toBe(3);
  });

  it("หน้าปกของช่องคือรูปที่ปักหมุด ไม่ใช่รูปที่ถ่ายทีหลัง", () => {
    const t = buildTimeline(BORN, [
      item("เก่า-ปักหมุด", "2026-03-11", true),
      item("ใหม่กว่า", "2026-03-14"),
    ]);
    const w1 = t.slots.find((s) => s.id === "w1")!;
    expect(w1.cover?.id).toBe("เก่า-ปักหมุด");
    expect(w1.items.map((i) => i.id)).toEqual(["เก่า-ปักหมุด", "ใหม่กว่า"]);
  });

  it("ไม่มีหมุดก็เอารูปใหม่สุดเป็นหน้าปก", () => {
    const t = buildTimeline(BORN, [item("a", "2026-03-11"), item("b", "2026-03-14")]);
    expect(t.slots.find((s) => s.id === "w1")!.cover?.id).toBe("b");
  });

  it("รูปที่ถ่ายก่อนวันเกิดตกหายไป ไม่ไปโผล่สัปดาห์ที่ 1", () => {
    // เกิดเมื่อมีคนแก้วันเกิดให้ช้าลงหลังอัปรูปไปแล้ว
    const t = buildTimeline(BORN, [item("อัลตราซาวด์", "2026-01-20"), item("จริง", "2026-03-11")]);
    expect(t.slots.find((s) => s.id === "w1")!.items.map((i) => i.id)).toEqual(["จริง"]);
    expect(t.filled).toBe(1);
  });

  it("ช่องเกิน 3 ขวบโผล่เฉพาะตอนมีรูปจริง", () => {
    expect(buildTimeline(BORN, [item("a", "2026-03-11")]).slots).toHaveLength(SLOT_COUNT);

    const t = buildTimeline(BORN, [item("โต", "2029-06-01")]);
    expect(t.slots).toHaveLength(SLOT_COUNT + 1);
    expect(t.slots.at(-1)!.label).toBe("เกิน 3 ขวบ");
    // ไม่นับรวมใน filled เพราะไม่ใช่ช่องใน 3 ขวบ
    expect(t.filled).toBe(0);
  });

  it("startsOn ใช้เป็นวันตั้งต้นตอนอัปจากช่องว่างได้", () => {
    const t = buildTimeline(BORN, []);
    expect(t.slots.find((s) => s.id === "w1")!.startsOn).toBe("2026-03-10");
    expect(t.slots.find((s) => s.id === "m2")!.startsOn).toBe("2026-05-10");
    expect(t.slots.find((s) => s.id === "q24")!.startsOn).toBe("2028-03-10");
  });

  it("รับ takenAt ที่มีเวลาต่อท้ายได้", () => {
    const t = buildTimeline(BORN, [item("a", "2026-03-12T08:30:00")]);
    expect(t.slots.find((s) => s.id === "w1")!.items.map((i) => i.id)).toEqual(["a"]);
  });

  it("หลายรูปในช่องเดียวกันเรียงใหม่ไปเก่า", () => {
    const t = buildTimeline(BORN, [
      item("กลาง", "2026-03-12"),
      item("เก่า", "2026-03-10"),
      item("ใหม่", "2026-03-15"),
    ]);
    expect(t.slots[0].items.map((i) => i.id)).toEqual(["ใหม่", "กลาง", "เก่า"]);
  });
});
