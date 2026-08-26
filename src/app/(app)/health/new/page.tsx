import { redirect } from "next/navigation";
import { HealthForm } from "@/components/health/form";
import { getLogFormDefaults, requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "เพิ่มบันทึกสุขภาพ · Pre Care" };

export default async function NewLogPage() {
  let ctx;
  try {
    // ต้องเป็น editor ขึ้นไปถึงจะเข้าหน้านี้ได้ — viewer เข้าตรงๆ ก็ไม่ได้
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/health");
  }

  const d = await getLogFormDefaults(ctx.db, ctx.familyId);
  return <HealthForm suggestedWeek={d.suggestedWeek} lastWeight={d.lastWeight} />;
}
