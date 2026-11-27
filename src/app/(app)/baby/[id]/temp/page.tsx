import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { listChildTemps } from "@/lib/child-care-queries";
import { can } from "@/lib/authz";
import { localNowIso } from "@/lib/local-time";
import { TEMP_SITE_LABEL, isYoungInfant, newbornSection, newbornSignTable, tempLabel } from "@/lib/child-temp";
import { thaiDate } from "@/lib/format";
import { Card } from "@/components/ui/card";
import { TempForm } from "@/components/baby/care/temp-form";
import { TempDelete } from "@/components/baby/care/temp-delete";

export const metadata = { title: "บันทึกไข้ · Pre Care" };

/**
 * D4 — บันทึกไข้ + ค่าที่วัดล่าสุด
 *
 * editor เห็นฟอร์ม · viewer เห็นแค่รายการ
 * ⚠️ ไม่มีเกณฑ์ตัวเลข รายการแสดงค่าตามที่วัด ไม่ระบายสีว่าสูง/ต่ำ
 */
export default async function ChildTempPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }
  const child = await getChild(ctx.db, ctx.familyId, id);
  if (!child) notFound();

  const temps = await listChildTemps(ctx.db, ctx.familyId, child.id);
  const canWrite = can.writeRecords(ctx.role);
  const today = localNowIso().slice(0, 10);
  const young = isYoungInfant(child.birthDate, today);

  const list = (
    <Card className="flex flex-col p-0">
      <h2 className="border-b border-cream-200 px-3.5 py-2.5 text-sm text-ink-600">วัดล่าสุด</h2>
      {temps.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] text-ink-600">ยังไม่มีบันทึก</p>
      ) : (
        <ul className="divide-y divide-cream-200">
          {temps.map((t) => (
            <li key={t.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <span className="w-[4.5rem] shrink-0 text-[17px] font-semibold tabular-nums text-ink-900">
                {tempLabel(t.tempTenths)}
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-[13px] text-ink-900">
                  {TEMP_SITE_LABEL[t.site]}
                  {t.symptoms.length > 0 && ` · ${t.symptoms.join(" · ")}`}
                </span>
                <span className="text-xs text-ink-600">
                  {t.measuredAt.slice(0, 10) === today ? "วันนี้" : thaiDate(t.measuredAt.slice(0, 10))}{" "}
                  {t.measuredAt.slice(11, 16)} · บันทึกโดย{" "}
                  {t.createdBy === ctx.user.id ? "คุณ" : (t.createdByName ?? "สมาชิก")}
                </span>
              </span>
              {canWrite && <TempDelete tempId={t.id} label={`${tempLabel(t.tempTenths)} ${t.measuredAt.slice(11, 16)}`} />}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );

  if (!canWrite) {
    return (
      <div className="flex flex-col gap-3 pb-24">
        <header className="flex items-center gap-2">
          <Link
            href={`/baby/${child.id}/log`}
            aria-label="กลับหน้าบันทึก"
            className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
          >
            <ChevronLeft size={22} />
          </Link>
          <h1 className="truncate text-lg font-semibold text-ink-900">ไข้ · {child.name}</h1>
        </header>
        {list}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 pb-24">
      {sp.saved && (
        <p role="status" className="rounded-md bg-ink-900 px-4 py-3 text-sm text-white">
          บันทึกแล้ว
        </p>
      )}
      <TempForm
        childId={child.id}
        childName={child.name}
        initialTenths={temps[0]?.tempTenths ?? 370}
        young={young}
        newbornNote={newbornSection().note ?? ""}
        signsFor={newbornSignTable()}
      />
      {list}
    </div>
  );
}
