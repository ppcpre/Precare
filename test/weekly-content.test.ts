/**
 * ชุดข้อมูลรายสัปดาห์ — เป็นข้อมูลที่แปลงมาจากเอกสารด้วยสคริปต์
 * ถ้าแปลงพลาดจะไม่มีอะไรฟ้อง จนกว่าผู้ใช้จะเปิดหน้าแรกในสัปดาห์นั้นพอดี
 */
import { describe, expect, it } from "vitest";
import {
  MAX_WEEK,
  MIN_WEEK,
  WEEKLY_CONTENT,
  sizeImageKey,
  weeklyContent,
  WHO_FIRST_WEEK,
  LENGTH_JUMP_WEEKS,
  lengthJumpNote,
} from "@/data/weekly-content";

describe("ชุดข้อมูลรายสัปดาห์", () => {
  it("ครบทุกสัปดาห์ตั้งแต่ 4 ถึง 40 ไม่ขาดไม่ซ้ำ", () => {
    expect(WEEKLY_CONTENT).toHaveLength(MAX_WEEK - MIN_WEEK + 1);
    const weeks = WEEKLY_CONTENT.map((w) => w.week);
    expect(weeks).toEqual(Array.from({ length: 37 }, (_, i) => i + MIN_WEEK));
  });

  it("ทุกสัปดาห์มีคำบรรยายและของเทียบขนาด", () => {
    for (const w of WEEKLY_CONTENT) {
      expect(w.size.length, `สัปดาห์ ${w.week}`).toBeGreaterThan(0);
      expect(w.development.length, `สัปดาห์ ${w.week}`).toBeGreaterThan(10);
    }
  });

  it("สัปดาห์ 4–7 ไม่มีตัวเลข ส่วน 8 ขึ้นไปต้องมีครบ", () => {
    for (const w of WEEKLY_CONTENT) {
      if (w.week <= 7) {
        expect(w.lengthCm, `สัปดาห์ ${w.week}`).toBeNull();
        expect(w.weightG, `สัปดาห์ ${w.week}`).toBeNull();
      } else {
        expect(w.lengthCm, `สัปดาห์ ${w.week}`).toBeGreaterThan(0);
        expect(w.weightG, `สัปดาห์ ${w.week}`).toBeGreaterThan(0);
      }
    }
  });

  it("วิธีวัดเปลี่ยนที่สัปดาห์ 21 พอดี", () => {
    for (const w of WEEKLY_CONTENT) {
      expect(w.measure, `สัปดาห์ ${w.week}`).toBe(w.week <= 20 ? "crown-rump" : "crown-heel");
    }
  });

  it("น้ำหนักต้องเพิ่มขึ้นเรื่อยๆ ไม่มีสัปดาห์ไหนลดลง", () => {
    const withWeight = WEEKLY_CONTENT.filter((w) => w.weightG != null);
    for (let i = 1; i < withWeight.length; i++) {
      expect(withWeight[i].weightG!, `สัปดาห์ ${withWeight[i].week}`).toBeGreaterThan(
        withWeight[i - 1].weightG!,
      );
    }
  });

  it("ความยาวเพิ่มขึ้นเรื่อยๆ ยกเว้นตอนเปลี่ยนวิธีวัดที่สัปดาห์ 21", () => {
    const rows = WEEKLY_CONTENT.filter((w) => w.lengthCm != null);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].lengthCm!, `สัปดาห์ ${rows[i].week}`).toBeGreaterThan(rows[i - 1].lengthCm!);
    }
    // ยืนยันว่าการกระโดดมาจากการเปลี่ยนวิธีวัดจริง ไม่ใช่ข้อมูลเพี้ยน
    const w20 = WEEKLY_CONTENT.find((w) => w.week === 20)!;
    const w21 = WEEKLY_CONTENT.find((w) => w.week === 21)!;
    expect(w21.lengthCm! - w20.lengthCm!).toBeGreaterThan(9);
    expect(w20.measure).not.toBe(w21.measure);
  });

  /**
   * ความยาวห้ามกระโดดนอกจากสองจุดที่บันทึกไว้
   *
   * เทสต์เดิมเช็คแค่ว่า "เพิ่มขึ้นเรื่อยๆ" กับรอยที่สัปดาห์ 21 — รอยที่สัปดาห์ 25
   * (30.0 → 34.6 ทั้งที่สัปดาห์อื่นเพิ่ม ~1.1) จึงนั่งอยู่ในข้อมูลโดยไม่มีใครเห็น
   * จนผู้ใช้ทักเรื่องน้ำหนักแล้วไปเจอตอนไล่ตรวจชุดเดียวกัน
   *
   * ตัวนี้ล็อกว่ารอยต่อมีได้เฉพาะสัปดาห์ใน LENGTH_JUMP_WEEKS เท่านั้น
   * ถ้าวันหนึ่งมีคนแก้ตัวเลขแล้วเกิดรอยใหม่ จะแดงทันทีพร้อมบอกว่าอยู่สัปดาห์ไหน
   */
  it("ความยาวกระโดดได้เฉพาะสัปดาห์ที่บันทึกเหตุผลไว้แล้ว", () => {
    const rows = WEEKLY_CONTENT.filter((w) => w.lengthCm != null);
    const MAX_STEP = 2.0; // ซม. ต่อสัปดาห์ — ปกติเพิ่ม 1.0–1.3
    const unexplained: string[] = [];

    for (let i = 1; i < rows.length; i++) {
      const step = rows[i].lengthCm! - rows[i - 1].lengthCm!;
      const known = (LENGTH_JUMP_WEEKS as readonly number[]).includes(rows[i].week);
      if (step > MAX_STEP && !known) {
        unexplained.push(`สัปดาห์ ${rows[i].week} (+${step.toFixed(1)} ซม.)`);
      }
      // และสัปดาห์ที่บันทึกว่ามีรอย ต้องมีรอยจริง ไม่ใช่รายการที่ค้างอยู่เฉยๆ
      if (known) expect(step, `สัปดาห์ ${rows[i].week}`).toBeGreaterThan(MAX_STEP);
    }

    expect(unexplained, `รอยต่อที่ไม่มีคำอธิบาย: ${unexplained.join(", ")}`).toEqual([]);
  });

  it("ทุกรอยต่อของความยาวมีข้อความอธิบายให้ผู้ใช้อ่าน", () => {
    for (const week of LENGTH_JUMP_WEEKS) {
      expect(lengthJumpNote(week), `สัปดาห์ ${week}`).toBeTruthy();
      // สัปดาห์ถัดไปก็ยังต้องอธิบาย คนเปิดแอปช้าหนึ่งสัปดาห์ต้องไม่พลาดคำอธิบาย
      expect(lengthJumpNote(week + 1), `สัปดาห์ ${week + 1}`).toBeTruthy();
    }
    // สัปดาห์ที่ไม่ได้อยู่ติดรอยต่อต้องไม่ขึ้นข้อความ ไม่งั้นกลายเป็นเสียงรบกวน
    expect(lengthJumpNote(30)).toBeNull();
    expect(lengthJumpNote(16)).toBeNull();
  });

  /**
   * ตัวเลขน้ำหนักต้องตรงกับตารางที่ 11 ของ WHO เป๊ะๆ
   *
   * ชุดเดิมใช้ตาราง Utah ซึ่งต่ำกว่าความจริงเป็นระบบ — 10 สัปดาห์จาก 27 ค่าที่
   * เรียกว่า "ค่าเฉลี่ย" ต่ำกว่าเปอร์เซ็นไทล์ที่ 10 ของ WHO ด้วยซ้ำ ทำให้พ่อแม่
   * ที่ลูกปกติดีคิดว่าลูกตัวเล็ก และเลขไม่ตรงกับที่หมอวัดได้
   *
   * ล็อกค่าไว้ทุกสัปดาห์ ไม่ใช่สุ่มเช็ค เพราะตัวเลขทางการแพทย์ที่เปลี่ยนไป
   * ทีละตัวโดยไม่มีใครสังเกตคือสิ่งที่เพิ่งเกิดขึ้นมาแล้วรอบหนึ่ง
   */
  it("น้ำหนักสัปดาห์ 14–40 ตรงกับ WHO Fetal Growth Charts ตารางที่ 11", () => {
    // [สัปดาห์, เปอร์เซ็นไทล์ 10, 50, 90] — WHO 2017 (Kiserud et al.) รวมทุกเพศ
    const WHO: [number, number, number, number][] = [
      [14, 78, 90, 104], [15, 99, 114, 132], [16, 124, 144, 166], [17, 155, 179, 207],
      [18, 192, 222, 255], [19, 235, 272, 313], [20, 286, 330, 380], [21, 345, 398, 458],
      [22, 412, 476, 548], [23, 489, 565, 650], [24, 576, 665, 765], [25, 673, 778, 894],
      [26, 780, 902, 1038], [27, 898, 1039, 1196], [28, 1026, 1189, 1368], [29, 1165, 1350, 1554],
      [30, 1313, 1523, 1753], [31, 1470, 1707, 1964], [32, 1635, 1901, 2187], [33, 1807, 2103, 2419],
      [34, 1985, 2312, 2659], [35, 2167, 2527, 2904], [36, 2352, 2745, 3153], [37, 2537, 2966, 3403],
      [38, 2723, 3186, 3652], [39, 2905, 3403, 3897], [40, 3084, 3617, 4135],
    ];
    expect(WHO).toHaveLength(MAX_WEEK - WHO_FIRST_WEEK + 1);
    for (const [week, lo, mid, hi] of WHO) {
      const row = WEEKLY_CONTENT.find((w) => w.week === week)!;
      expect(row.weightG, `สัปดาห์ ${week} ค่ากลาง`).toBe(mid);
      expect(row.weightLowG, `สัปดาห์ ${week} ขอบล่าง`).toBe(lo);
      expect(row.weightHighG, `สัปดาห์ ${week} ขอบบน`).toBe(hi);
    }
  });

  it("ช่วงปกติมีเฉพาะตั้งแต่สัปดาห์ 14 — ก่อนหน้านั้นไม่มีเกณฑ์มาตรฐาน", () => {
    for (const w of WEEKLY_CONTENT) {
      const should = w.week >= WHO_FIRST_WEEK;
      expect(w.weightLowG != null, `สัปดาห์ ${w.week}`).toBe(should);
      expect(w.weightHighG != null, `สัปดาห์ ${w.week}`).toBe(should);
    }
  });

  it("ค่ากลางต้องอยู่ในช่วงเสมอ ไม่ใช่หลุดออกนอกกรอบที่เราบอกว่าปกติ", () => {
    for (const w of WEEKLY_CONTENT) {
      if (w.weightLowG == null || w.weightHighG == null) continue;
      expect(w.weightLowG, `สัปดาห์ ${w.week}`).toBeLessThan(w.weightG!);
      expect(w.weightG!, `สัปดาห์ ${w.week}`).toBeLessThan(w.weightHighG);
    }
  });

  it("ขอบล่างและขอบบนก็ต้องเพิ่มขึ้นเรื่อยๆ ทั้งคู่", () => {
    const rows = WEEKLY_CONTENT.filter((w) => w.weightLowG != null);
    for (let i = 1; i < rows.length; i++) {
      expect(rows[i].weightLowG!, `ขอบล่าง สัปดาห์ ${rows[i].week}`).toBeGreaterThan(
        rows[i - 1].weightLowG!,
      );
      expect(rows[i].weightHighG!, `ขอบบน สัปดาห์ ${rows[i].week}`).toBeGreaterThan(
        rows[i - 1].weightHighG!,
      );
    }
  });

  it("ไตรมาสแบ่งตามเกณฑ์ 1–12 / 13–27 / 28–40", () => {
    for (const w of WEEKLY_CONTENT) {
      const expected = w.week <= 12 ? 1 : w.week <= 27 ? 2 : 3;
      expect(w.trimester, `สัปดาห์ ${w.week}`).toBe(expected);
    }
  });
});

describe("weeklyContent()", () => {
  it("คืนสัปดาห์ที่ถูกต้อง", () => {
    expect(weeklyContent(24)?.size).toBe("ข้าวโพด");
    expect(weeklyContent(4)?.week).toBe(4);
    expect(weeklyContent(40)?.week).toBe(40);
  });

  it("คืน null เมื่ออยู่นอกช่วง — การ์ดจะได้ไม่ขึ้นแทนที่จะพัง", () => {
    expect(weeklyContent(3)).toBeNull();
    expect(weeklyContent(41)).toBeNull();
    expect(weeklyContent(null)).toBeNull();
    expect(weeklyContent(undefined)).toBeNull();
  });
});

describe("sizeImageKey()", () => {
  it("เติมศูนย์หน้าเลขสัปดาห์ ให้ชื่อไฟล์เรียงถูกใน bucket", () => {
    expect(sizeImageKey(4)).toBe("weekly/size/w04.webp");
    expect(sizeImageKey(24)).toBe("weekly/size/w24.webp");
    expect(sizeImageKey(40)).toBe("weekly/size/w40.webp");
  });
});
