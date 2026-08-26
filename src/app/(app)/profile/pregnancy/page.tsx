import { redirect } from "next/navigation";
import { count, eq } from "drizzle-orm";
import { PregnancyForm } from "@/components/profile/pregnancy-form";
import { getPregnancy, requireFamilyContext } from "@/lib/queries";
import { weeklyLogs } from "@/db/schema";

export const metadata = { title: "วันตั้งครรภ์ · Pre Care" };

export default async function PregnancySettingsPage() {
  let ctx;
  try {
    // owner เท่านั้นตาม permission matrix — editor แก้ไม่ได้
    ctx = await requireFamilyContext("owner");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/profile");
  }

  const [preg, logCount] = await Promise.all([
    getPregnancy(ctx.db, ctx.familyId),
    ctx.db
      .select({ n: count() })
      .from(weeklyLogs)
      .where(eq(weeklyLogs.familyId, ctx.familyId))
      .get(),
  ]);

  return (
    <PregnancyForm
      currentLmp={preg.profile?.lmpDate ?? null}
      currentDue={preg.profile?.dueDate ?? null}
      hasLogs={(logCount?.n ?? 0) > 0}
    />
  );
}
