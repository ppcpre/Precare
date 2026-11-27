import { describe, expect, it } from "vitest";
import { parseNutrition, parsePortion, scaleNutrition } from "@/lib/nutrition";

/**
 * อ่านคำตอบของโมเดล — ด่านเดียวที่กันตัวเลขพิลึกไม่ให้เข้าไปในยอดรวมของวัน
 *
 * โมเดลตอบผิดแบบมั่นใจได้ (เจอมาแล้วกับการอ่านใบเสร็จ) และคำตอบที่ผิดจนเป็น
 * อันตรายคือค่าที่สูงเกินจริงมากๆ ซึ่งจะทำให้ยอดรวมทั้งวันเพี้ยนจนผู้ใช้สับสน
 */
const ok = `{"kcal": 590, "carb_g": 72, "sugar_g": 6, "protein_g": 28, "basis": "1 จาน ประมาณ 350 กรัม"}`;

describe("อ่านค่าโภชนาการจากคำตอบของโมเดล", () => {
  it("คำตอบปกติอ่านได้ครบ", () => {
    expect(parseNutrition(ok)).toEqual({
      kcal: 590, carbG: 72, sugarG: 6, proteinG: 28, basis: "1 จาน ประมาณ 350 กรัม",
    });
  });

  /** โมเดลชอบห่อด้วย ```json หรือพิมพ์คำนำหน้า แม้จะสั่งห้ามแล้ว */
  it("มีข้อความหุ้มรอบ JSON ก็ยังอ่านได้", () => {
    expect(parseNutrition("นี่คือค่าโดยประมาณครับ\n```json\n" + ok + "\n```")?.kcal).toBe(590);
  });

  it("บอกว่าไม่รู้จักอาหารนี้ = อ่านไม่ได้ ไม่ใช่ศูนย์", () => {
    expect(parseNutrition(`{"unknown": true}`)).toBeNull();
  });

  it("ขาดค่าหลักแม้แต่ตัวเดียวถือว่าอ่านไม่ได้ ดีกว่าโชว์ครึ่งๆ", () => {
    expect(parseNutrition(`{"kcal": 500, "carb_g": 60, "sugar_g": 5}`)).toBeNull();
  });

  /** กันคำตอบที่ผิดจนยอดรวมทั้งวันเพี้ยน */
  it("ค่าเกินเพดานความสมเหตุสมผลถือว่าอ่านไม่ได้", () => {
    expect(parseNutrition(`{"kcal": 50000, "carb_g": 72, "sugar_g": 6, "protein_g": 28}`)).toBeNull();
    expect(parseNutrition(`{"kcal": 590, "carb_g": 72, "sugar_g": 6, "protein_g": -5}`)).toBeNull();
  });

  /** โมเดลสลับคาร์บกับน้ำตาลบ่อย — น้ำตาลเป็นส่วนหนึ่งของคาร์บ มากกว่ากันไม่ได้ */
  it("น้ำตาลมากกว่าคาร์บถูกหั่นลงมาเท่าคาร์บ", () => {
    expect(parseNutrition(`{"kcal": 200, "carb_g": 30, "sugar_g": 45, "protein_g": 2}`)?.sugarG).toBe(30);
  });

  it("ตัวเลขที่ส่งมาเป็นสตริงหรือทศนิยมก็รับได้", () => {
    const v = parseNutrition(`{"kcal": "320", "carb_g": 47.6, "sugar_g": 3.2, "protein_g": 18}`);
    expect(v).toMatchObject({ kcal: 320, carbG: 48, sugarG: 3 });
  });

  it("คำตอบที่ไม่ใช่ JSON เลย = อ่านไม่ได้", () => {
    for (const t of [null, "", "ไม่ทราบครับ", "{ พัง"]) expect(parseNutrition(t)).toBeNull();
  });
});

/**
 * ปริมาณที่เป็นเศษหรือหลายหน่วย — โมเดลคูณเลขไม่เป็น เราต้องคูณเอง
 *
 * วัดจริงเมื่อ 5 ต.ค. 69: ข้าวมันไก่ 1 จาน = 650 kcal แต่ถาม "1/4 จาน"
 * ได้ 450 (ควรเป็น ~163) และ "0.5 จาน" ได้ 550 (ควรเป็น 325)
 * ถ้าปล่อยให้โมเดลคิด ยอดรวมทั้งวันของคนที่กินครึ่งจานจะเกินจริงเกือบสองเท่า
 */
describe("แยกจำนวนออกจากหน่วยของปริมาณ", () => {
  it("เศษส่วนแบบพิมพ์ด้วยสแลช", () => {
    expect(parsePortion("1/4 จาน")).toEqual({ qty: 0.25, unit: "จาน" });
    expect(parsePortion("3/4 ถ้วย")).toEqual({ qty: 0.75, unit: "ถ้วย" });
  });

  it("ทศนิยมและจำนวนเต็ม", () => {
    expect(parsePortion("0.5 จาน")).toEqual({ qty: 0.5, unit: "จาน" });
    expect(parsePortion("2 แก้ว")).toEqual({ qty: 2, unit: "แก้ว" });
    expect(parsePortion("1 จาน")).toEqual({ qty: 1, unit: "จาน" });
  });

  it("จำนวนคละเศษ — ต้องไม่อ่านได้แค่จำนวนเต็มข้างหน้า", () => {
    expect(parsePortion("1 1/2 จาน")).toEqual({ qty: 1.5, unit: "จาน" });
  });

  it("เศษส่วนยูนิโคดที่กดจากแป้นพิมพ์มือถือ", () => {
    expect(parsePortion("½ จาน")).toEqual({ qty: 0.5, unit: "จาน" });
    expect(parsePortion("¼จาน")).toEqual({ qty: 0.25, unit: "จาน" });
  });

  it("คำบอกจำนวนแบบไทย ทั้งมีและไม่มีช่องว่าง", () => {
    expect(parsePortion("ครึ่งจาน")).toEqual({ qty: 0.5, unit: "จาน" });
    expect(parsePortion("สอง แก้ว")).toEqual({ qty: 2, unit: "แก้ว" });
  });

  it("ไม่มีจำนวน = หนึ่งหน่วยของสิ่งที่พิมพ์มา", () => {
    expect(parsePortion("ถ้วยเล็ก")).toEqual({ qty: 1, unit: "ถ้วยเล็ก" });
    expect(parsePortion(null)).toEqual({ qty: 1, unit: "" });
    expect(parsePortion("  ")).toEqual({ qty: 1, unit: "" });
  });

  it("จำนวนพิลึกถูกบีบให้อยู่ในช่วงที่เป็นไปได้", () => {
    expect(parsePortion("0 จาน").qty).toBe(0.05);
    expect(parsePortion("500 จาน").qty).toBe(20);
    expect(parsePortion("1/0 จาน")).toEqual({ qty: 1, unit: "1/0 จาน" });
  });
});

describe("คูณค่าโภชนาการตามจำนวน", () => {
  const plate = { kcal: 650, carbG: 80, sugarG: 10, proteinG: 30, basis: "1 จาน ประมาณ 400 กรัม" };

  it("หนึ่งในสี่จานได้หนึ่งในสี่ของค่า ไม่ใช่ 69% อย่างที่โมเดลตอบ", () => {
    expect(scaleNutrition(plate, 0.25, "1/4 จาน")).toMatchObject({
      kcal: 163, carbG: 20, sugarG: 3, proteinG: 8,
    });
  });

  it("บอกที่มาของการคูณ ไม่ใช่โชว์เลขที่คิดมาแล้วเฉยๆ", () => {
    expect(scaleNutrition(plate, 0.5, "0.5 จาน").basis).toBe("1 จาน ประมาณ 400 กรัม × 0.5 จาน");
  });

  it("หนึ่งหน่วยไม่แตะอะไรเลย", () => {
    expect(scaleNutrition(plate, 1, "1 จาน")).toBe(plate);
  });

  it("เพดานต่อเมนูยังบังคับหลังคูณ — 10 จานไม่ทะลุไปพังยอดรวมทั้งวัน", () => {
    const big = scaleNutrition(plate, 10, "10 จาน");
    expect(big.kcal).toBe(3000);
    expect(big.carbG).toBe(500);
  });

  it("น้ำตาลยังไม่เกินคาร์บหลังคูณ", () => {
    const odd = { kcal: 100, carbG: 10, sugarG: 10, proteinG: 1, basis: null };
    const r = scaleNutrition(odd, 60, "60 ชิ้น");
    expect(r.sugarG).toBeLessThanOrEqual(r.carbG);
  });
});
