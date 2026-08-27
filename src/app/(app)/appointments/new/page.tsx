import { redirect } from "next/navigation";
import { AppointmentForm } from "@/components/appointments/form";
import { listCareGroups, requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "เพิ่มนัดหมาย · Pre Care" };

export default async function NewAppointmentPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/appointments");
  }
  const groups = await listCareGroups(ctx.db, ctx.familyId);
  return <AppointmentForm groups={groups} />;
}
