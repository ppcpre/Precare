import { describe, expect, it } from "vitest";
import { bucketize, rangeStart, type DailyTotal } from "@/lib/food-history";

/** เมนู n รายการที่มีตัวเลขครบ รวมได้ kcal ตามที่ส่งมา */
const row = (eatenOn: string, kcal: number, n = 3): DailyTotal => ({
  eatenOn,
  kcal,
  carbG: Math.round(kcal / 10),
  sugarG: 5,
  proteinG: 20,
  nKcal: n,
  nCarbG: n,
  nSugarG: n,
  nProteinG: n,
});

describe("จัดกลุ่มยอดรวมเป็นช่องของกราฟ", () => {
  it("รายวันได้ 14 ช่องเรียงเก่าไปใหม่ ลงท้ายที่วันนี้", () => {
    const b = bucketize([], "day", "2026-10-04", "kcal");
    expect(b).toHaveLength(14);
    expect(b[0].key).toBe("2026-09-21");
    expect(b[13].key).toBe("2026-10-04");
  });

  it("วันที่ไม่มีบันทึกเป็น null ไม่ใช่ศูนย์ — ไม่ได้บันทึกกับกินศูนย์แคลคนละเรื่อง", () => {
    const b = bucketize([row("2026-10-04", 1800)], "day", "2026-10-04", "kcal");
    expect(b[13].value).toBe(1800);
    expect(b[12].value).toBeNull();
    expect(b[12].days).toBe(0);
  });

  /**
   * จุดที่พลาดง่ายที่สุด: สัปดาห์ที่บันทึกแค่สองวัน ถ้าหารเจ็ด
   * จะกลายเป็นว่ากินวันละ 500 แคล ซึ่งไม่เป็นความจริงเลย
   */
  it("รายสัปดาห์เฉลี่ยด้วยจำนวนวันที่บันทึก ไม่ใช่เจ็ดวัน", () => {
    // 2026-09-28 เป็นวันจันทร์ บันทึกสองวันในสัปดาห์เดียวกัน
    const b = bucketize([row("2026-09-28", 2000), row("2026-09-30", 1000)], "week", "2026-10-04", "kcal");
    const wk = b.find((x) => x.key === "2026-09-28");
    expect(wk?.days).toBe(2);
    expect(wk?.value).toBe(1500);
  });

  it("วันอาทิตย์ถูกนับเข้าสัปดาห์ที่เริ่มวันจันทร์ก่อนหน้า", () => {
    // 2026-10-04 เป็นวันอาทิตย์ สัปดาห์ของมันเริ่ม 2026-09-28
    const b = bucketize([row("2026-10-04", 2100)], "week", "2026-10-04", "kcal");
    expect(b.at(-1)?.key).toBe("2026-09-28");
    expect(b.at(-1)?.value).toBe(2100);
  });

  it("รายเดือนได้ 6 เดือน และข้ามปีได้", () => {
    const b = bucketize([row("2026-01-15", 1500)], "month", "2026-03-10", "kcal");
    expect(b.map((x) => x.key)).toEqual([
      "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01",
    ]);
    expect(b[3].value).toBe(1500);
  });

  it("วันที่บันทึกเมนูแต่ไม่ได้ใส่ตัวเลข ไม่ถูกนับเป็นวันที่กินศูนย์", () => {
    const b = bucketize([row("2026-10-03", 0, 0), row("2026-10-04", 1800)], "week", "2026-10-04", "kcal");
    expect(b.at(-1)?.days).toBe(1);
    expect(b.at(-1)?.value).toBe(1800);
  });

  /**
   * เมนูที่ไม่มีตัวเลขบันทึกได้ (ตั้งใจ) และคนมักกรอกแคลแต่เว้นโปรตีนว่าง
   * ถ้าใช้ตัวหารร่วมกันทุกสารอาหาร โปรตีนจะถูกเฉลี่ยต่ำกว่าความจริง
   * โดยไม่มีอะไรฟ้องเลย — เห็นแค่กราฟที่ดูเหมือนกินโปรตีนน้อย
   */
  it("กรอกแคลแต่เว้นโปรตีนว่าง ค่าเฉลี่ยโปรตีนต้องไม่ถูกหารด้วยวันที่ไม่ได้กรอก", () => {
    const rows: DailyTotal[] = [
      {
        eatenOn: "2026-09-30", kcal: 2000, carbG: 200, sugarG: 20, proteinG: 0,
        nKcal: 3, nCarbG: 3, nSugarG: 3, nProteinG: 0,
      },
      {
        eatenOn: "2026-10-04", kcal: 1800, carbG: 180, sugarG: 18, proteinG: 60,
        nKcal: 3, nCarbG: 3, nSugarG: 3, nProteinG: 2,
      },
    ];
    expect(bucketize(rows, "week", "2026-10-04", "kcal").at(-1)).toMatchObject({
      days: 2, value: 1900,
    });
    expect(bucketize(rows, "week", "2026-10-04", "proteinG").at(-1)).toMatchObject({
      days: 1, value: 60,
    });
  });

  it("ต้นช่วงที่ต้องดึงจากฐานข้อมูลตรงกับช่องแรกของกราฟ", () => {
    for (const r of ["day", "week", "month"] as const) {
      expect(rangeStart(r, "2026-10-04")).toBe(bucketize([], r, "2026-10-04", "kcal")[0].key);
    }
  });
});
