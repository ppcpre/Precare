import { describe, expect, it } from "vitest";
import { isValidDay, localNowIso, localToday, shiftDay } from "@/lib/local-time";
import { eatenOnInput } from "@/lib/validation";

/**
 * เวลานัดหมายเก็บเป็น "เวลาที่โรงพยาบาล" แบบไม่มี timezone (ดู components/appointments/form.tsx)
 * แต่ทุกที่ในแอปเอาไปเทียบกับ new Date().toISOString() ซึ่งเป็น UTC
 *
 * ไทยเร็วกว่า UTC 7 ชั่วโมง การเทียบสตริงจึงทำให้นัดที่ผ่านไปแล้วยังถูกนับเป็น
 * "กำลังจะถึง" ได้นานถึง 7 ชั่วโมง — โผล่บนหน้าแรกว่าเป็นนัดถัดไป ค้างอยู่ในแท็บ
 * กำลังจะถึง และ /api/push/next ก็ยังเอานัดนั้นไปแจ้งเตือน
 */
describe("เวลาปัจจุบันแบบเดียวกับที่เก็บนัดหมาย", () => {
  /** 1 ต.ค. 2569 03:00 UTC = 10:00 ตามเวลาไทย */
  const NOW = Date.UTC(2026, 9, 1, 3, 0, 0);

  it("คืนเวลาไทยในรูปแบบเดียวกับที่เก็บในฐานข้อมูล", () => {
    expect(localNowIso(NOW)).toBe("2026-10-01T10:00:00");
  });

  it("นัดที่ผ่านไปแล้วหนึ่งชั่วโมง ต้องนับเป็นอดีต", () => {
    const appt = "2026-10-01T09:00:00";
    expect(appt < localNowIso(NOW)).toBe(true);

    // ของเดิมเทียบกับ UTC แล้วได้ผลตรงข้าม — นัดที่ผ่านไปแล้วยังถูกนับว่ายังไม่ถึง
    const utc = new Date(NOW).toISOString();
    expect(appt >= utc).toBe(true);
  });

  it("นัดอีกสองชั่วโมงข้างหน้า ยังเป็นอนาคต", () => {
    expect("2026-10-01T12:00:00" >= localNowIso(NOW)).toBe(true);
  });

  it("ข้ามวันได้ถูกต้อง — ห้าทุ่มครึ่ง UTC คือเช้าวันถัดไปของไทย", () => {
    expect(localNowIso(Date.UTC(2026, 9, 1, 23, 30, 0))).toBe("2026-10-02T06:30:00");
  });

  it("ยาวเท่ากับรูปแบบที่เก็บเสมอ เทียบสตริงจึงเชื่อถือได้", () => {
    expect(localNowIso(Date.UTC(2026, 0, 5, 0, 0, 0))).toHaveLength("2026-01-05T07:00:00".length);
  });
});

describe("วันตามปฏิทินไทย", () => {
  it("เลื่อนวันข้ามเดือนและข้ามปีได้", () => {
    expect(shiftDay("2026-10-05", -1)).toBe("2026-10-04");
    expect(shiftDay("2026-10-01", -1)).toBe("2026-09-30");
    expect(shiftDay("2026-01-01", -1)).toBe("2025-12-31");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });

  /** 2028 เป็นปีอธิกสุรทิน ถ้าคิดวันด้วยการบวกเดือนตรงๆ จะพลาดตรงนี้ */
  it("ปีอธิกสุรทินถูกต้อง", () => {
    expect(shiftDay("2028-02-28", 1)).toBe("2028-02-29");
    expect(shiftDay("2028-03-01", -1)).toBe("2028-02-29");
  });

  /**
   * ตอน 06:00 ของเมืองไทยคือ 23:00 ของวันก่อนหน้าใน UTC
   * ถ้าใช้ toISOString() ตรงๆ จะได้วันที่ผิดไปหนึ่งวันทุกเช้า
   */
  it("วันนี้คิดตามเวลาไทย ไม่ใช่ UTC", () => {
    const sixAmBangkok = Date.parse("2026-10-05T06:00:00+07:00");
    expect(localToday(sixAmBangkok)).toBe("2026-10-05");
    expect(new Date(sixAmBangkok).toISOString().slice(0, 10)).toBe("2026-10-04");
  });

  it("ค่าที่ไม่ใช่วันจริงถูกปฏิเสธ", () => {
    expect(isValidDay("2026-10-05")).toBe(true);
    expect(isValidDay("2026-13-01")).toBe(false);
    expect(isValidDay("2026-02-30")).toBe(false);
    expect(isValidDay("5/10/2026")).toBe(false);
    expect(isValidDay(undefined)).toBe(false);
  });
});

describe("วันที่ของบันทึกอาหาร", () => {
  const today = localToday();

  it("วันนี้และย้อนหลังผ่าน — คนลืมบันทึกเป็นเรื่องปกติ", () => {
    expect(eatenOnInput.safeParse(today).success).toBe(true);
    expect(eatenOnInput.safeParse(shiftDay(today, -1)).success).toBe(true);
    expect(eatenOnInput.safeParse(shiftDay(today, -400)).success).toBe(true);
  });

  /** กันที่ schema ไม่ใช่แค่ max= ของช่องวันที่ — ยิง action ตรงได้ */
  it("วันอนาคตไม่ผ่าน ไม่ว่าจะพรุ่งนี้หรือปีหน้า", () => {
    for (const d of [shiftDay(today, 1), shiftDay(today, 365)]) {
      const r = eatenOnInput.safeParse(d);
      expect(r.success).toBe(false);
      if (!r.success) expect(r.error.issues[0].message).toBe("บันทึกล่วงหน้าไม่ได้");
    }
  });

  it("วันที่ไม่มีจริงไม่ผ่าน แม้รูปแบบจะถูก", () => {
    expect(eatenOnInput.safeParse("2026-02-30").success).toBe(false);
  });
});
