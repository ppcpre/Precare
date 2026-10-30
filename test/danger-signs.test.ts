import { describe, expect, it } from "vitest";
import {
  DANGER_GROUPS,
  DISCLAIMER,
  EMS,
  SELF_HARM,
  findGroup,
  signsFor,
  type DangerSign,
} from "@/data/danger-signs";

const allSigns = (): DangerSign[] =>
  DANGER_GROUPS.flatMap((g) => g.sections.flatMap((s) => s.signs));

describe("โครงสร้างเนื้อหา", () => {
  it("มีครบสามหมวด และ id ไม่ซ้ำ", () => {
    expect(DANGER_GROUPS.map((g) => g.id)).toEqual(["pregnancy", "elderly", "child"]);
  });

  it("ทุกหมวดมีชื่อและบรรทัดบอกใบ้ ไม่มีช่องว่าง", () => {
    for (const g of DANGER_GROUPS) {
      expect(g.name.trim(), g.id).not.toBe("");
      expect(g.hint.trim(), g.id).not.toBe("");
      expect(g.sections.length, g.id).toBeGreaterThan(0);
    }
  });

  it("ทุกอาการมีข้อความ ไม่มีบรรทัดว่าง", () => {
    for (const s of allSigns()) {
      expect(s.label.trim(), s.id).not.toBe("");
      for (const d of s.details) expect(d.trim(), `${s.id} → ${d}`).not.toBe("");
    }
  });

  it("id ของอาการไม่ซ้ำกันภายในหมวดเดียวกัน", () => {
    for (const g of DANGER_GROUPS) {
      const ids = g.sections.flatMap((s) => s.signs.map((x) => `${s.id}/${x.id}`));
      expect(new Set(ids).size, g.id).toBe(ids.length);
    }
  });

  it("แต่ละหมวดมีหัวข้อที่ต้องรีบที่สุดหนึ่งอัน", () => {
    for (const g of DANGER_GROUPS) {
      expect(g.sections.filter((s) => s.urgent).length, g.id).toBe(1);
    }
  });
});

describe("หมวดคนท้อง", () => {
  const preg = findGroup("pregnancy")!;

  /**
   * CDC มี 15 รายการ — 14 อยู่ในลิสต์ + ข้อสุขภาพจิตที่แยกเป็นกล่องของตัวเอง
   * ถ้าวันหนึ่งตัวเลขนี้เปลี่ยนโดยไม่มีใครตั้งใจ แปลว่ามีคนเพิ่มหรือลบอาการ
   */
  it("มี 14 อาการในลิสต์ บวกข้อสุขภาพจิตที่แยกออกมา = 15 ตาม CDC", () => {
    const inList = preg.sections
      .filter((s) => s.id !== "observed")
      .flatMap((s) => s.signs).length;
    expect(inList).toBe(14);
    expect(SELF_HARM.id).toBe("self-harm");
  });

  it("ตอนตั้งครรภ์ไม่เห็นอาการของหลังคลอด และกลับกัน", () => {
    const bleeding = preg.sections.find((s) => s.id === "bleeding")!;

    const whilePregnant = signsFor(bleeding, "pregnant").map((s) => s.id);
    expect(whilePregnant).toContain("movement");
    expect(whilePregnant).not.toContain("pp-bleeding");

    const afterBirth = signsFor(bleeding, "postpartum").map((s) => s.id);
    expect(afterBirth).toContain("pp-bleeding");
    expect(afterBirth).not.toContain("movement");
  });

  /**
   * หมวด "สิ่งที่คนรอบตัวเห็นก่อน" ไม่ใช่เนื้อหาใหม่ — เป็นการหยิบข้อย่อยจาก
   * รายการ CDC มาจัดใหม่ในมุมคนที่ไม่ได้มีอาการเอง ทุกบรรทัดต้องสืบกลับได้
   * ไม่งั้นมันจะค่อยๆ กลายเป็นรายการที่เราแต่งเอง
   */
  it("ทุกบรรทัดในหมวดคนรอบตัวสืบกลับไปที่อาการจริงได้", () => {
    const known = new Set([
      ...preg.sections.flatMap((s) => s.signs.map((x) => x.id)),
      SELF_HARM.id,
    ]);
    const observed = preg.sections.find((s) => s.id === "observed")!;

    for (const sign of observed.signs) {
      expect(sign.derivedFrom, `${sign.id} ต้องระบุว่ามาจากอาการข้อไหน`).toBeTruthy();
      for (const src of sign.derivedFrom!) {
        expect(known.has(src), `${sign.id} อ้างถึง "${src}" ที่ไม่มีอยู่จริง`).toBe(true);
      }
    }
  });

  it("หมวดอื่นห้ามใช้ derivedFrom — มีไว้สำหรับหมวดคนรอบตัวเท่านั้น", () => {
    for (const g of DANGER_GROUPS) {
      for (const s of g.sections) {
        if (s.id === "observed") continue;
        for (const sign of s.signs) {
          expect(sign.derivedFrom, `${g.id}/${s.id}/${sign.id}`).toBeUndefined();
        }
      }
    }
  });

  it("ปุ่มโทร รพ. ที่ฝากครรภ์อยู่เฉพาะหมวดคนท้อง", () => {
    expect(preg.showHospital).toBe(true);
    for (const g of DANGER_GROUPS) {
      if (g.id !== "pregnancy") expect(g.showHospital, g.id).toBeFalsy();
    }
  });
});

describe("หมวดผู้สูงอายุ", () => {
  const eld = findGroup("elderly")!;

  it("สโตรคครบ 5 ข้อตาม B.E. F.A.S.T.", () => {
    const stroke = eld.sections.find((s) => s.id === "stroke")!;
    expect(stroke.signs.map((s) => s.id)).toEqual([
      "face",
      "arm",
      "speech",
      "eyes",
      "balance",
    ]);
  });

  /**
   * ข้อความเรื่องจดเวลาเป็นสิ่งที่ต้องทำ ไม่ใช่คำอธิบายที่ตัดได้ตอนทำหน้าให้กระชับ
   * ยาละลายลิ่มเลือดมีกรอบเวลา ถ้าตอบหมอไม่ได้ว่าเริ่มกี่โมงอาจให้ยาไม่ได้
   */
  it("หมวดสโตรคต้องบอกให้จดเวลาที่เริ่มมีอาการ", () => {
    const stroke = eld.sections.find((s) => s.id === "stroke")!;
    expect(stroke.action).toMatch(/จดเวลา/);
  });

  it("บอกว่าผู้หญิงมาด้วยอาการต่างจากผู้ชาย", () => {
    const heart = eld.sections.find((s) => s.id === "heart")!;
    expect(heart.note).toMatch(/ผู้หญิง/);
  });

  /**
   * หมวดหกล้มยังหาแนวปฏิบัติฉบับเดียวที่ระบุชัดไม่ได้ (ดู docs §2.3)
   * ถ้าวันหนึ่งมีคนเติมเข้ามา ต้องมาพร้อมแหล่งอ้างอิงและอัปเดตเอกสาร
   */
  it("ยังไม่มีหมวดหกล้ม จนกว่าจะหาแหล่งอ้างอิงได้", () => {
    expect(eld.sections.map((s) => s.id)).not.toContain("fall");
  });
});

describe("หมวดเด็กเล็ก", () => {
  const child = findGroup("child")!;

  it("แยกสองช่วงอายุ เพราะเกณฑ์คนละชุด", () => {
    expect(child.sections.map((s) => s.id)).toEqual(["newborn", "toddler"]);
  });

  it("กลุ่ม 2 เดือน–5 ขวบ ใช้ 4 ข้อของ WHO", () => {
    const toddler = child.sections.find((s) => s.id === "toddler")!;
    expect(toddler.signs.map((s) => s.id)).toEqual(["drink", "vomit", "fit", "lethargy"]);
  });

  /**
   * WHO ระบุว่าอกบุ๋ม "เล็กน้อย" เป็นเรื่องปกติในทารกแรกเกิด เฉพาะแบบรุนแรงจึงนับ
   * ถ้าเขียนว่า "อกบุ๋ม" เฉยๆ พ่อแม่จะพาไปโรงพยาบาลทุกคืน
   */
  it("ทารกแรกเกิดต้องเขียนว่าอกบุ๋ม \"ลึก\" ไม่ใช่อกบุ๋มเฉยๆ", () => {
    const newborn = child.sections.find((s) => s.id === "newborn")!;
    const breathing = newborn.signs.find((s) => s.id === "breathing")!;
    expect(breathing.label).toMatch(/อกบุ๋มลึก/);
  });
});

describe("เบอร์โทรและข้อความกำกับ", () => {
  it("เบอร์เป็นตัวเลขล้วน กดโทรได้", () => {
    expect(EMS.phone).toMatch(/^\d+$/);
    expect(SELF_HARM.phone).toMatch(/^\d+$/);
  });

  it("ชี้ไปที่แอป ThaiEMS แทนการสร้างระบบส่งพิกัดเอง", () => {
    expect(EMS.appHint).toMatch(/ThaiEMS/);
  });

  it("ข้อความกำกับบอกที่มาและบอกว่าไม่ใช่การวินิจฉัย", () => {
    expect(DISCLAIMER).toMatch(/WHO/);
    expect(DISCLAIMER).toMatch(/ไม่ใช่การวินิจฉัย/);
  });
});
