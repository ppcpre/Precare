import { describe, expect, it } from "vitest";
import { bucketize, rangeStart, type DailyTotal } from "@/lib/food-history";

const row = (eatenOn: string, kcal: number, items = 3): DailyTotal => ({
  eatenOn,
  kcal,
  carbG: kcal / 10,
  sugarG: 5,
  proteinG: 20,
  items,
});

describe("จัดกลุ่มยอดรวมเป็นช่องของกราฟ", () => {
  it("รายวันได้ 14 ช่องเรียงเก่าไปใหม่ ลงท้ายที่วันนี้", () => {
    const b = bucketize([], "day", "2026-10-04");
    expect(b).toHaveLength(14);
    expect(b[0].key).toBe("2026-09-21");
    expect(b[13].key).toBe("2026-10-04");
  });

  it("วันที่ไม่มีบันทึกเป็น null ไม่ใช่ศูนย์ — ไม่ได้บันทึกกับกินศูนย์แคลคนละเรื่อง", () => {
    const b = bucketize([row("2026-10-04", 1800)], "day", "2026-10-04");
    expect(b[13].kcal).toBe(1800);
    expect(b[12].kcal).toBeNull();
    expect(b[12].days).toBe(0);
  });

  /**
   * จุดที่พลาดง่ายที่สุด: สัปดาห์ที่บันทึกแค่สองวัน ถ้าหารเจ็ด
   * จะกลายเป็นว่ากินวันละ 500 แคล ซึ่งไม่เป็นความจริงเลย
   */
  it("รายสัปดาห์เฉลี่ยด้วยจำนวนวันที่บันทึก ไม่ใช่เจ็ดวัน", () => {
    // 2026-09-28 เป็นวันจันทร์ บันทึกสองวันในสัปดาห์เดียวกัน
    const b = bucketize([row("2026-09-28", 2000), row("2026-09-30", 1000)], "week", "2026-10-04");
    const wk = b.find((x) => x.key === "2026-09-28");
    expect(wk?.days).toBe(2);
    expect(wk?.kcal).toBe(1500);
  });

  it("วันอาทิตย์ถูกนับเข้าสัปดาห์ที่เริ่มวันจันทร์ก่อนหน้า", () => {
    // 2026-10-04 เป็นวันอาทิตย์ สัปดาห์ของมันเริ่ม 2026-09-28
    const b = bucketize([row("2026-10-04", 2100)], "week", "2026-10-04");
    expect(b.at(-1)?.key).toBe("2026-09-28");
    expect(b.at(-1)?.kcal).toBe(2100);
  });

  it("รายเดือนได้ 6 เดือน และข้ามปีได้", () => {
    const b = bucketize([row("2026-01-15", 1500)], "month", "2026-03-10");
    expect(b.map((x) => x.key)).toEqual([
      "2025-10-01", "2025-11-01", "2025-12-01", "2026-01-01", "2026-02-01", "2026-03-01",
    ]);
    expect(b[3].kcal).toBe(1500);
  });

  it("แถวที่ไม่มีเมนูเลยไม่ถูกนับเป็นวันที่บันทึก", () => {
    const b = bucketize([row("2026-10-03", 0, 0), row("2026-10-04", 1800)], "week", "2026-10-04");
    expect(b.at(-1)?.days).toBe(1);
    expect(b.at(-1)?.kcal).toBe(1800);
  });

  it("ต้นช่วงที่ต้องดึงจากฐานข้อมูลตรงกับช่องแรกของกราฟ", () => {
    for (const r of ["day", "week", "month"] as const) {
      expect(rangeStart(r, "2026-10-04")).toBe(bucketize([], r, "2026-10-04")[0].key);
    }
  });
});
