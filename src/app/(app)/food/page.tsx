import { redirect } from "next/navigation";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FoodForm } from "@/components/food/food-form";
import { FoodItemRow } from "@/components/food/item-row";
import { getFoodDay, listRecentFoods, requireFamilyContext } from "@/lib/queries";
import { localNowIso } from "@/lib/local-time";
import { SLOT_LABEL } from "@/lib/nutrition";
import { MEAL_SLOTS, type MealSlot } from "@/db/schema";
import { can } from "@/lib/authz";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "นับแคล · Pre Care" };

/** มื้อที่น่าจะกำลังจะบันทึก ตามเวลาของวัน — เดาให้ถูกบ่อยๆ ดีกว่าให้เลือกทุกครั้ง */
function slotOfHour(hour: number): MealSlot {
  if (hour < 10) return "breakfast";
  if (hour < 15) return "lunch";
  if (hour < 21) return "dinner";
  return "snack";
}

export default async function FoodPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  // วันนี้ตามเวลาไทย ไม่ใช่ UTC — worker รันด้วย UTC เสมอ
  const nowLocal = localNowIso();
  const today = nowLocal.slice(0, 10);
  const [day, recent] = await Promise.all([
    getFoodDay(ctx.db, ctx.familyId, today),
    listRecentFoods(ctx.db, ctx.familyId),
  ]);
  const canWrite = can.writeRecords(ctx.role);

  const stat = (label: string, value: number, unit: string, color: string) => (
    <div className="flex flex-col gap-0.5 rounded-sm bg-white/80 px-3 py-2.5">
      <span className="text-[11px] text-ink-600">{label}</span>
      <span className="flex items-baseline gap-1">
        <b className={`text-xl leading-none ${color}`}>{value.toLocaleString("th-TH")}</b>
        <span className="text-[11px] text-ink-600">{unit}</span>
      </span>
    </div>
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-baseline gap-2">
          <h1 className="text-xl font-semibold text-ink-900">นับแคล</h1>
          <span className="truncate text-xs text-ink-400">{thaiDate(today)}</span>
        </div>
        <Link
          href="/food/history"
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-brown-700 hover:bg-cream-100"
        >
          <ChartColumn size={17} strokeWidth={1.9} />
          ย้อนหลัง
        </Link>
      </header>

      <Card className="flex flex-col gap-3 border-peach-300 bg-peach-100">
        {/* สี่ค่าเรียง 2×2 — สี่คอลัมน์แถวเดียวบีบจนเลขอ่านยากบนจอมือถือ */}
        <div data-testid="food-totals" className="grid grid-cols-2 gap-2">
          {stat("พลังงาน", day.totals.kcal, "kcal", "text-peach-700")}
          {stat("คาร์บ", day.totals.carbG, "ก.", "text-brown-700")}
          {stat("น้ำตาล", day.totals.sugarG, "ก.", "text-danger")}
          {stat("โปรตีน", day.totals.proteinG, "ก.", "text-sage-700")}
        </div>
        <p className="text-[11px] leading-relaxed text-ink-400">
          ค่าประมาณจากชื่อเมนู ไม่ใช่การวัดจริง ใช้ดูแนวโน้มได้ แต่ไม่ใช่คำแนะนำทางการแพทย์
          {day.missing > 0 && ` · ${day.missing} รายการยังไม่มีตัวเลข จึงไม่ถูกนับรวม`}
        </p>
      </Card>

      {day.items.length === 0 ? (
        <Card className="flex flex-col gap-1.5">
          <span className="font-medium text-ink-900">ยังไม่ได้บันทึกอะไรวันนี้</span>
          <span className="text-[13px] leading-relaxed text-ink-600">
            พิมพ์ชื่อเมนูที่กิน แล้วให้ AI ช่วยประมาณพลังงานและสารอาหารให้
          </span>
        </Card>
      ) : (
        <Card className="flex flex-col gap-3">
          {MEAL_SLOTS.map((slot) => {
            const items = day.items.filter((i) => i.slot === slot);
            if (items.length === 0) return null;
            return (
              <section key={slot} className="flex flex-col gap-1.5">
                <h2 className="text-xs font-medium text-ink-600">{SLOT_LABEL[slot]}</h2>
                {items.map((i) => (
                  <FoodItemRow key={i.id} item={i} canWrite={canWrite} />
                ))}
              </section>
            );
          })}
        </Card>
      )}

      {canWrite ? (
        <Card className="flex flex-col gap-3">
          <h2 className="font-medium text-ink-900">เพิ่มเมนู</h2>
          <FoodForm slot={slotOfHour(Number(nowLocal.slice(11, 13)))} recent={recent} />
        </Card>
      ) : (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
          คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้ จึงเพิ่มรายการอาหารไม่ได้
        </p>
      )}
    </div>
  );
}
