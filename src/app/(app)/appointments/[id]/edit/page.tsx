import { notFound, redirect } from "next/navigation";
import { AppointmentForm } from "@/components/appointments/form";
import { getAppointmentById, listCareGroups, requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "แก้ไขนัดหมาย · Pre Care" };

export default async function EditAppointmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/appointments");
  }

  const [appt, groups] = await Promise.all([
    getAppointmentById(ctx.db, ctx.familyId, id),
    listCareGroups(ctx.db, ctx.familyId),
  ]);
  if (!appt) notFound();

  return <AppointmentForm appt={appt} groups={groups} />;
}
