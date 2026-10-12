import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MedicationList } from "@/components/medications/list";
import { MedicationForm } from "@/components/medications/form";
import { getMedicationsDay, listMedications, requireFamilyContext } from "@/lib/queries";
import { localNowIso, localToday } from "@/lib/local-time";
import { can } from "@/lib/authz";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "ยาและวิตามิน · Pre Care" };

export default async function MedicationsPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const today = localToday();
  const nowHm = localNowIso().slice(11, 16);
  const [doses, meds] = await Promise.all([
    getMedicationsDay(ctx.db, ctx.familyId, ctx.user.id, today),
    listMedications(ctx.db, ctx.familyId, ctx.user.id),
  ]);
  const canWrite = can.writeRecords(ctx.role);

  const taken = doses.filter((d) => d.takenAt).length;

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center gap-1">
        <Link
          href="/appointments"
          aria-label="กลับไปหน้านัดหมาย"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={21} strokeWidth={1.9} />
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">ยาและวิตามิน</h1>
        <span className="ml-auto text-xs text-ink-400">{thaiDate(today)}</span>
      </header>

      <Card className="flex flex-col gap-3">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="font-medium text-ink-900">ของวันนี้</h2>
          {doses.length > 0 && (
            <span className="text-[13px] text-ink-600">
              กินแล้ว {taken} จาก {doses.length}
            </span>
          )}
        </div>

        {doses.length === 0 ? (
          <p className="text-[13px] leading-relaxed text-ink-600">
            ยังไม่มีรายการของวันนี้ · เพิ่มยาหรือวิตามินที่ต้องกินประจำไว้
            แล้วระบบจะเตือนตามเวลาที่ตั้ง
          </p>
        ) : (
          <MedicationList doses={doses} dueOn={today} nowHm={nowHm} canWrite={canWrite} />
        )}
      </Card>

      {canWrite ? (
        <MedicationForm meds={meds} today={today} />
      ) : (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
          คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้ จึงเพิ่มหรือแก้รายการยาไม่ได้
        </p>
      )}

      <p className="px-1 text-[11px] leading-relaxed text-ink-400">
        แอปนี้ช่วยเตือนตามเวลาที่คุณตั้งเองเท่านั้น ไม่ได้ตรวจสอบขนาดยา
        การใช้ร่วมกัน หรือความปลอดภัยในการตั้งครรภ์ — เรื่องยาให้ถามแพทย์หรือเภสัชกร
      </p>
    </div>
  );
}
