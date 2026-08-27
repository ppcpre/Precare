import { redirect } from "next/navigation";
import Link from "next/link";
import { CalendarDays, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { AppointmentCard } from "@/components/appointments/card";
import { NotifyBanner } from "@/components/appointments/notify-banner";
import { daysFromNow } from "@/components/ui/badge";
import { listAppointments, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";
import { cn } from "@/lib/cn";
import type { Appointment } from "@/types";

export const metadata = { title: "นัดหมายแพทย์ · Pre Care" };

/** จัดกลุ่มตามความใกล้ ตาม screen-blueprint §6.4 */
function bucketOf(days: number) {
  if (days < 0) return "ผ่านมาแล้ว";
  if (days <= 1) return "วันนี้";
  if (days <= 7) return "สัปดาห์นี้";
  if (days <= 30) return "เดือนนี้";
  return "ในอนาคต";
}

export default async function AppointmentsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab } = await searchParams;
  const past = tab === "past";

  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  // now มาจาก query ไม่ใช่เรียก Date.now() ใน render
  const { items, now } = await listAppointments(ctx.db, ctx.familyId, past ? "past" : "upcoming");
  const canWrite = can.writeRecords(ctx.role);

  const groups = new Map<string, { appt: Appointment; days: number }[]>();
  for (const a of items) {
    const days = daysFromNow(a.apptDatetime, now);
    const k = bucketOf(days);
    const arr = groups.get(k) ?? [];
    arr.push({ appt: a, days });
    groups.set(k, arr);
  }

  const tabCls = (on: boolean) =>
    cn(
      "flex h-10 flex-1 items-center justify-center rounded-sm px-2 text-sm transition-colors",
      on ? "bg-white font-medium text-brown-900 shadow-[var(--shadow-card)]" : "text-ink-600",
    );

  return (
    <div className="flex flex-col gap-4 pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">นัดหมายแพทย์</h1>
        {/* ครอบด้วย span แทนการใส่ hidden ลงบนปุ่มตรงๆ — cn() เป็นแค่ join
            ไม่ได้ merge class ที่ชนกัน ตัวปุ่มมี inline-flex เป็น base อยู่แล้ว
            พอเติม hidden เข้าไปทั้งคู่จะอยู่ใน class list แล้วลำดับใน CSS
            เป็นตัวตัดสิน ซึ่ง inline-flex ชนะ ปุ่มเลยโผล่บนมือถือคู่กับ FAB */}
        {canWrite && (
          <span className="hidden md:block">
            <ButtonLink href="/appointments/new" variant="secondary">
              <Plus size={18} strokeWidth={2} />
              เพิ่มนัดหมาย
            </ButtonLink>
          </span>
        )}
      </header>

      <div className="flex gap-1 rounded-[10px] bg-cream-100 p-1">
        <Link href="/appointments" className={tabCls(!past)}>
          กำลังจะถึง
        </Link>
        <Link href="/appointments?tab=past" className={tabCls(past)}>
          ผ่านมาแล้ว
        </Link>
      </div>

      {!past && <NotifyBanner />}

      {items.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title={past ? "ยังไม่มีนัดหมายที่ผ่านมา" : "ยังไม่มีนัดหมาย"}
          description={
            past
              ? "นัดหมายที่เลยเวลาแล้วจะมาแสดงที่นี่"
              : "เพิ่มนัดตรวจครรภ์ครั้งถัดไป แล้วเราจะเตือนคุณล่วงหน้า"
          }
          action={
            canWrite && !past ? <ButtonLink href="/appointments/new">เพิ่มนัดหมาย</ButtonLink> : undefined
          }
        />
      ) : (
        [...groups].map(([bucket, list]) => (
          <section key={bucket} className="flex flex-col gap-3">
            <h2 className="sticky top-0 z-10 bg-cream-50 py-1 text-sm text-ink-600">{bucket}</h2>
            {list.map(({ appt, days }) => (
              <AppointmentCard key={appt.id} appt={appt} days={days} canEdit={canWrite} />
            ))}
          </section>
        ))
      )}

      {canWrite && (
        <Link
          href="/appointments/new"
          aria-label="เพิ่มนัดหมาย"
          className="fixed bottom-20 right-4 flex size-14 items-center justify-center rounded-full bg-brown-700 text-white shadow-[0_4px_12px_rgba(43,36,32,0.18)] md:hidden"
        >
          <Plus size={26} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
