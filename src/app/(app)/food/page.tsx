import { redirect } from "next/navigation";
import Link from "next/link";
import { ChartColumn } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FoodForm } from "@/components/food/food-form";
import { FoodItemRow } from "@/components/food/item-row";
import {
  getFoodDay,
  getFoodDayByMember,
  listRecentFoods,
  requireFamilyContext,
} from "@/lib/queries";
import { PersonTabs } from "@/components/food/person-tabs";
import { DayNav } from "@/components/food/day-nav";
import { isValidDay, localNowIso, localToday } from "@/lib/local-time";
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

export default async function FoodPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; d?: string }>;
}) {
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
  const today = localToday();
  const q = await searchParams;

  /**
   * วันที่กำลังดู — ย้อนหลังได้ (ลืมบันทึกเป็นเรื่องปกติ) แต่ล่วงหน้าไม่ได้
   * ค่าพิลึกหรือวันอนาคตที่ใส่มาทาง URL ตกกลับมาเป็นวันนี้ ไม่ใช่หน้าพัง
   */
  const day = isValidDay(q.d) && q.d <= today ? q.d : today;
  const isToday = day === today;

  const people = await getFoodDayByMember(ctx.db, ctx.familyId, day, ctx.user.id);
  /**
   * ?u= ต้องเป็นคนที่อยู่ในแถบจริง ไม่ใช่ id อะไรก็ได้ที่ใส่มาใน URL
   * ไม่งั้นจะอ่านบันทึกของคนนอกครอบครัวได้ด้วยการเดา id
   */
  const asked = q.u;
  const target = people.find((p) => p.userId === asked) ?? people.find((p) => p.isMe);
  const viewing = target?.userId ?? ctx.user.id;
  const isMine = viewing === ctx.user.id;

  const [entries, recent] = await Promise.all([
    getFoodDay(ctx.db, ctx.familyId, viewing, day),
    isMine ? listRecentFoods(ctx.db, ctx.familyId, ctx.user.id) : Promise.resolve([]),
  ]);
  // เพิ่ม/แก้ได้เฉพาะมื้อของตัวเอง — ของคนอื่นดูได้อย่างเดียว
  const canWrite = can.writeRecords(ctx.role) && isMine;

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
      <header className="flex flex-col gap-1.5">
        <div className="flex items-center justify-between gap-2">
          <h1 className="text-xl font-semibold text-ink-900">นับแคล</h1>
          <Link
            href={isMine ? "/food/history" : `/food/history?u=${viewing}`}
            className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-brown-700 hover:bg-cream-100"
          >
            <ChartColumn size={17} strokeWidth={1.9} />
            ย้อนหลัง
          </Link>
        </div>
        <DayNav day={day} today={today} userId={viewing} isMine={isMine} />
      </header>

      {/* คนเดียวในครอบครัวไม่ต้องมีแถบเลือกคน — มีแต่จะเปลืองที่และทำให้สงสัยว่า
          จะเลือกอะไร (ครอบครัวส่วนใหญ่เริ่มจากคนเดียวก่อนเชิญคนอื่น) */}
      {people.length > 1 && (
        <PersonTabs people={people} selected={viewing} day={day} today={today} />
      )}

      <Card className="flex flex-col gap-3 border-peach-300 bg-peach-100">
        {/* สี่ค่าเรียง 2×2 — สี่คอลัมน์แถวเดียวบีบจนเลขอ่านยากบนจอมือถือ */}
        <div data-testid="food-totals" className="grid grid-cols-2 gap-2">
          {stat("พลังงาน", entries.totals.kcal, "kcal", "text-peach-700")}
          {stat("คาร์บ", entries.totals.carbG, "ก.", "text-brown-700")}
          {stat("น้ำตาล", entries.totals.sugarG, "ก.", "text-danger")}
          {stat("โปรตีน", entries.totals.proteinG, "ก.", "text-sage-700")}
        </div>
        <p className="text-[11px] leading-relaxed text-ink-400">
          ค่าประมาณจากชื่อเมนู ไม่ใช่การวัดจริง ใช้ดูแนวโน้มได้ แต่ไม่ใช่คำแนะนำทางการแพทย์
          {entries.missing > 0 && ` · ${entries.missing} รายการยังไม่มีตัวเลข จึงไม่ถูกนับรวม`}
        </p>
      </Card>

      {entries.items.length === 0 ? (
        <Card className="flex flex-col gap-1.5">
          <span className="font-medium text-ink-900">
            {isMine
              ? `ยังไม่ได้บันทึกอะไร${isToday ? "วันนี้" : ` วันที่ ${thaiDate(day)}`}`
              : `${target?.name} ยังไม่ได้บันทึกอะไร${isToday ? "วันนี้" : ` วันที่ ${thaiDate(day)}`}`}
          </span>
          <span className="text-[13px] leading-relaxed text-ink-600">
            {isMine
              ? "พิมพ์ชื่อเมนูที่กิน แล้วให้ AI ช่วยประมาณพลังงานและสารอาหารให้"
              : "เห็นได้ทันทีเมื่อเขาบันทึก"}
          </span>
        </Card>
      ) : (
        <Card data-testid="food-list" className="flex flex-col gap-3">
          {MEAL_SLOTS.map((slot) => {
            const items = entries.items.filter((i) => i.slot === slot);
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
          <h2 className="font-medium text-ink-900">
            เพิ่มเมนูของฉัน
            {!isToday && (
              <span className="font-normal text-ink-600"> · ย้อนหลังวันที่ {thaiDate(day)}</span>
            )}
          </h2>
          <FoodForm
            eatenOn={day}
            isToday={isToday}
            /**
             * วันนี้เดามื้อจากเวลา แต่วันย้อนหลังเวลาไม่ได้บอกอะไร — เดาเป็น
             * มื้อแรกที่ยังไม่มีรายการแทน ซึ่งตรงกับการไล่จดทั้งวันจากเช้าไปเย็น
             */
            slot={
              isToday
                ? slotOfHour(Number(nowLocal.slice(11, 13)))
                : (MEAL_SLOTS.find((sl) => !entries.items.some((i) => i.slot === sl)) ?? "snack")
            }
            recent={recent}
          />
        </Card>
      ) : (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] leading-relaxed text-ink-600">
          {!isMine
            ? `รายการอาหารของ ${target?.name} ดูได้อย่างเดียว · เพิ่มหรือแก้ได้เฉพาะมื้อของตัวเอง`
            : "คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้ จึงเพิ่มรายการอาหารไม่ได้"}
        </p>
      )}
    </div>
  );
}
