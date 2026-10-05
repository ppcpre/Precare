import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { FoodHistoryChart } from "@/components/food/history-chart";
import { getFoodDailyTotals, getFoodDayByMember, requireFamilyContext } from "@/lib/queries";
import { localNowIso } from "@/lib/local-time";
import { rangeStart } from "@/lib/food-history";

export const metadata = { title: "ย้อนหลัง · นับแคล · Pre Care" };

export default async function FoodHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string }>;
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

  const today = localNowIso().slice(0, 10);

  /**
   * คนที่กำลังดู มาจาก ?u= เหมือนหน้านับแคล และต้องตรวจว่าเป็นคนในครอบครัวจริง
   * ไม่ใช่ id อะไรก็ได้ที่ใส่มาใน URL — ไม่งั้นเดา id แล้วอ่านของคนนอกได้
   */
  const people = await getFoodDayByMember(ctx.db, ctx.familyId, today, ctx.user.id);
  const asked = (await searchParams).u;
  const target = people.find((p) => p.userId === asked) ?? people.find((p) => p.isMe);
  const viewing = target?.userId ?? ctx.user.id;
  /**
   * ดึงครั้งเดียวให้ครอบมุมมองที่กว้างสุด (รายเดือน) แล้วให้ฝั่งเครื่องจัดกลุ่ม
   * ทั้งสามมุมมองจากข้อมูลชุดเดียวกัน — สลับแท็บจึงไม่ต้องยิง request ใหม่
   *
   * ขอบท้ายเป็น "พรุ่งนี้" เพราะ query ใช้ `<` ไม่ใช่ `<=` ถ้าใส่วันนี้
   * บันทึกของวันนี้จะหายไปจากกราฟทั้งหมด ซึ่งเป็นบั๊กที่เงียบมาก
   */
  const tomorrow = new Date(Date.parse(`${today}T00:00:00Z`) + 86_400_000)
    .toISOString()
    .slice(0, 10);
  const rows = await getFoodDailyTotals(
    ctx.db,
    ctx.familyId,
    viewing,
    rangeStart("month", today),
    tomorrow,
  );

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-1">
        <Link
          href={target?.isMe ? "/food" : `/food?u=${viewing}`}
          aria-label="กลับไปหน้านับแคล"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={21} strokeWidth={1.9} />
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">ย้อนหลัง</h1>
        {/* ชื่อเจ้าของกราฟต้องอยู่บนหน้า ไม่ใช่รู้จาก ?u= ใน URL เท่านั้น —
            กราฟของสองคนหน้าตาเหมือนกันหมด ดูไม่ออกว่าเป็นของใคร */}
        {target && !target.isMe && (
          <span className="truncate text-[13px] text-ink-600">ของ {target.name}</span>
        )}
      </header>

      <Card className="flex flex-col gap-3">
        <FoodHistoryChart rows={rows} today={today} />
      </Card>

      <p className="px-1 text-[11px] leading-relaxed text-ink-400">
        ตัวเลขเป็นค่าประมาณจากชื่อเมนู ไม่ใช่การวัดจริง ใช้ดูแนวโน้มของตัวเองได้
        แต่ไม่ใช่คำแนะนำทางการแพทย์ · วันที่ไม่ได้บันทึกจะไม่ถูกนับเป็นวันที่กินน้อย
      </p>
    </div>
  );
}
