import { redirect } from "next/navigation";
import { AppointmentForm } from "@/components/appointments/form";
import { requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "เพิ่มนัดหมาย · Pre Care" };

export default async function NewAppointmentPage() {
  try {
    await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/appointments");
  }
  return <AppointmentForm />;
}
