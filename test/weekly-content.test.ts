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
