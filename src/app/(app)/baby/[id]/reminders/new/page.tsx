import { notFound, redirect } from "next/navigation";
import { BABY_LOG_KINDS, type BabyLogKind } from "@/db/schema";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { listMyReminders } from "@/lib/baby-queries";
import { ReminderForm } from "@/components/baby/reminders/reminder-form";

export const metadata = { title: "ตั้งการแจ้งเตือน · Pre Care" };

/** C3 — ตั้งใหม่ · ?kind= เลือกเรื่องไว้ให้ก่อน */
export default async function NewBabyReminderPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ kind?: string }>;
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

  const mine = await listMyReminders(ctx.db, ctx.familyId, ctx.user.id, child.id);
  const taken = mine.map((r) => r.kind);
  const asked = (BABY_LOG_KINDS as readonly string[]).includes(sp.kind ?? "")
    ? (sp.kind as BabyLogKind)
    : null;
  const free = BABY_LOG_KINDS.filter((k) => !taken.includes(k));
  // ตั้งครบทุกเรื่องแล้ว = ไม่มีอะไรให้ตั้งใหม่ กลับไปแก้ตัวเดิม
  if (free.length === 0) redirect(`/baby/${child.id}/reminders`);
  const startKind = asked && !taken.includes(asked) ? asked : free[0];

  return <ReminderForm childId={child.id} initial={null} taken={taken} startKind={startKind} />;
}
