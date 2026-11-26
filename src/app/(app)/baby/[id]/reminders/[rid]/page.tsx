import { notFound, redirect } from "next/navigation";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { listMyReminders } from "@/lib/baby-queries";
import { ReminderForm } from "@/components/baby/reminders/reminder-form";

export const metadata = { title: "แก้การแจ้งเตือน · Pre Care" };

/** C3 — แก้ตัวเดิม · ของคนอื่นในบ้านเปิดไม่ได้ (listMyReminders กรองด้วย user) */
export default async function EditBabyReminderPage({
  params,
}: {
  params: Promise<{ id: string; rid: string }>;
}) {
  const { id, rid } = await params;
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

  const mine = await listMyReminders(ctx.db, ctx.familyId, ctx.user.id, child.id);
  const initial = mine.find((r) => r.id === rid);
  if (!initial) notFound();

  return (
    <ReminderForm
      childId={child.id}
      initial={initial}
      taken={mine.map((r) => r.kind)}
      startKind={initial.kind}
    />
  );
}
