import { notFound, redirect } from "next/navigation";
import { AppointmentForm } from "@/components/appointments/form";
import { AppointmentMedia } from "@/components/appointments/media-strip";
import {
  getAppointmentById,
  listAppointmentMedia,
  listCareGroups,
  requireFamilyContext,
} from "@/lib/queries";
import { can } from "@/lib/authz";

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

  const [appt, groups, media] = await Promise.all([
    getAppointmentById(ctx.db, ctx.familyId, id),
    listCareGroups(ctx.db, ctx.familyId),
    listAppointmentMedia(ctx.db, ctx.familyId, id),
  ]);
  if (!appt) notFound();

  return (
    <AppointmentForm
      appt={appt}
      groups={groups}
      media={
        <AppointmentMedia
          appointmentId={id}
          // วันที่ของนัดเป็นค่าตั้งต้นของ "วันที่ถ่าย" — ไฟล์จากวันตรวจ
          // ย่อมเป็นของวันนั้น ไม่ใช่วันที่คนนึกได้แล้วมาอัป
          takenAt={appt.apptDatetime.slice(0, 10)}
          items={media}
          canWrite={can.writeRecords(ctx.role)}
        />
      }
    />
  );
}
