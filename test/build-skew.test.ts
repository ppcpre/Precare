import { describe, expect, it } from "vitest";
import { shouldReload } from "@/lib/build-skew";

/**
 * เงื่อนไข "เมื่อไหร่ควรโหลดหน้าใหม่" — ผิดทางหนึ่งคือผู้ใช้ค้างกับบิลด์เก่า
 * แล้วกดอะไรก็ error ผิดอีกทางคือหน้ารีโหลดวนจนใช้งานไม่ได้เลย
 */
const base = { mine: "abc12345", theirs: "abc12345", reloadedBefore: false };

describe("ตัดสินว่าแอปเก่ากว่าเซิร์ฟเวอร์หรือยัง", () => {
  it("รหัสตรงกัน = ไม่ต้องทำอะไร", () => {
    expect(shouldReload(base)).toBe(false);
  });

  it("รหัสต่างกัน = โหลดใหม่", () => {
    expect(shouldReload({ ...base, theirs: "def67890" })).toBe(true);
  });

  /** โหลดแล้วรหัสยังไม่ตรง แปลว่ามีอย่างอื่นผิด การวนรีโหลดแย่กว่าใช้ของเก่าต่อ */
  it("เคยโหลดใหม่ไปแล้วในแท็บนี้ ห้ามโหลดซ้ำ", () => {
    expect(shouldReload({ ...base, theirs: "def67890", reloadedBefore: true })).toBe(false);
  });

  it("ไม่รู้รหัสฝั่งใดฝั่งหนึ่ง = ห้ามเดา", () => {
    expect(shouldReload({ ...base, mine: undefined, theirs: "def67890" })).toBe(false);
    expect(shouldReload({ ...base, theirs: undefined })).toBe(false);
    expect(shouldReload({ ...base, theirs: "" })).toBe(false);
    expect(shouldReload({ ...base, theirs: "unknown" })).toBe(false);
  });

  it("เซิร์ฟเวอร์ตอบมาไม่ใช่สตริง = ห้ามเดา", () => {
    for (const bad of [null, 42, {}, [], true]) {
      expect(shouldReload({ ...base, theirs: bad })).toBe(false);
    }
  });
});
