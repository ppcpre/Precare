import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Bell, ChevronLeft, Plus } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { latestBabyLogs, listMyReminders } from "@/lib/baby-queries";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { PushToggle } from "@/components/push-toggle";
import { ReminderList } from "@/components/baby/reminders/reminder-list";

export const metadata = { title: "การแจ้งเตือนของลูก · Pre Care" };

/**
 * C2 — การแจ้งเตือนของฉันสำหรับลูกคนนี้
 *
 * viewer เข้าได้ — ตั้งเตือนให้ตัวเองไม่ได้แก้ข้อมูลของครอบครัว
 */
export default async function BabyRemindersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
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

  const [reminders, { latest }, { env }] = await Promise.all([
    listMyReminders(ctx.db, ctx.familyId, ctx.user.id, child.id),
    latestBabyLogs(ctx.db, ctx.familyId, child.id),
    getCloudflareContext({ async: true }),
  ]);
  const newHref = `/baby/${child.id}/reminders/new`;

  return (
    <div className="flex flex-col gap-3 pb-24">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/baby/${child.id}/log`}
          aria-label="กลับหน้าบันทึก"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} />
        </Link>
        <h1 className="truncate text-lg font-semibold text-ink-900">การแจ้งเตือน · {child.name}</h1>
        <Link
          href={newHref}
          aria-label="เพิ่มการแจ้งเตือน"
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-brown-700 hover:bg-cream-100"
        >
          <Plus size={22} strokeWidth={2} />
        </Link>
      </header>

      <div className="flex items-start gap-2 rounded-md border border-cream-200 bg-cream-100 p-3">
        <Bell size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-brown-700" />
        <p className="text-xs leading-relaxed text-ink-600">
          เตือนเฉพาะเครื่องของคุณ คนอื่นในบ้านตั้งของตัวเองแยกได้ ตอนตีสามจะได้ไม่ปลุกทั้งบ้าน
        </p>
      </div>

      {reminders.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-5 text-center">
          <p className="text-[15px] text-ink-900">ยังไม่ได้ตั้งการแจ้งเตือน</p>
          <p className="text-[13px] text-ink-600">เช่น เตือนให้นมเมื่อผ่านไป 3 ชม. นับจากครั้งล่าสุด</p>
          <ButtonLink href={newHref}>ตั้งการแจ้งเตือน</ButtonLink>
        </Card>
      ) : (
        <>
          <ReminderList childId={child.id} reminders={reminders} latest={latest} />
          <p className="text-center text-xs text-ink-400">
            บันทึกใหม่เมื่อไหร่ เวลาเตือนเลื่อนตามเอง ไม่ต้องตั้งใหม่
          </p>
        </>
      )}

      <Card className="flex flex-col gap-2.5 p-3.5">
        <h2 className="text-sm text-ink-600">การแจ้งเตือนของเครื่องนี้</h2>
        <PushToggle vapidPublicKey={env.VAPID_PUBLIC_KEY ?? ""} />
      </Card>
    </div>
  );
}
