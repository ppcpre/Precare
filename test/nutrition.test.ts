import { describe, expect, it } from "vitest";
import { parseNutrition } from "@/lib/nutrition";

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
