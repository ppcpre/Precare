import { redirect } from "next/navigation";
import { AppointmentForm } from "@/components/appointments/form";
import { listCareGroups, listChildren, requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "เพิ่มนัดหมาย · Pre Care" };

export default async function NewAppointmentPage({
  searchParams,
}: {
  searchParams: Promise<{ child?: string }>;
}) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/appointments");
  }
  const [groups, kids] = await Promise.all([
    listCareGroups(ctx.db, ctx.familyId),
    listChildren(ctx.db, ctx.familyId),
  ]);
  // ?child= มาจาก URL — ฟอร์มเลือกให้ก็ต่อเมื่อเป็นลูกของบ้านนี้จริง (ดูใน AppointmentForm)
  return (
    <AppointmentForm
      groups={groups}
      kids={kids.map((k) => ({ id: k.id, name: k.name }))}
      initialChildId={sp.child ?? null}
    />
  );
}
