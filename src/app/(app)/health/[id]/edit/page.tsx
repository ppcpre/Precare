import { notFound, redirect } from "next/navigation";
import { HealthForm } from "@/components/health/form";
import { countPhotosByLog, getLogFormDefaults, getWeeklyLogById, requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "แก้ไขบันทึกสุขภาพ · Pre Care" };

export default async function EditLogPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/health");
  }

  // getWeeklyLogById กรอง familyId ให้แล้ว — เดา id ของบ้านอื่นไม่ได้
  const [log, d, counts] = await Promise.all([
    getWeeklyLogById(ctx.db, ctx.familyId, id),
    getLogFormDefaults(ctx.db, ctx.familyId),
    countPhotosByLog(ctx.db, ctx.familyId),
  ]);
  if (!log) notFound();

  return (
    <HealthForm
      log={log}
      suggestedWeek={d.suggestedWeek}
      lastWeight={d.lastWeight}
      photoCount={counts.get(log.id) ?? 0}
    />
  );
}
