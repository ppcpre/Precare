import { BottomNav, Sidebar } from "@/components/app-nav";
import { AppHeader } from "@/components/app-topbar";
import { AppointmentReminders, type Reminder } from "@/components/appointment-reminders";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/db";
import { getLayoutData } from "@/lib/queries";
import { timeOf } from "@/lib/format";

/** shell ของโซนที่ล็อกอินแล้ว — header + sidebar (จอกว้าง) / bottom nav (มือถือ) */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // ไม่มี session ปล่อยให้หน้าลูก redirect เอง — layout แค่ไม่แสดง header
  const data = user?.activeFamilyId
    ? await getLayoutData(await getDb(), user.activeFamilyId)
    : null;

  const reminders: Reminder[] =
    data?.upcoming
      .filter((a) => a.reminderEnabled)
      .map((a) => ({
        id: `${a.id}:${a.reminderMinutesBefore}`,
        at: new Date(a.apptDatetime).getTime() - a.reminderMinutesBefore * 60_000,
        title: a.title ? `นัดหมาย: ${a.title}` : "ใกล้ถึงเวลานัดหมาย",
        body: [timeOf(a.apptDatetime), a.doctorName, a.location].filter(Boolean).join(" · "),
      })) ?? [];

  return (
    <div className="flex min-h-dvh">
      <Sidebar />
      <div className="flex min-w-0 flex-1 flex-col">
        {user && (
          <AppHeader
            userName={user.name}
            userImage={user.image}
            familyName={data?.family?.name}
            hasSoonAppointment={data?.hasSoonAppointment}
          />
        )}
        <main className="flex-1 pb-16 md:pb-0">
          <div className="mx-auto w-full max-w-[1120px] px-4 py-4 md:px-12 md:py-8">{children}</div>
        </main>
      </div>
      <BottomNav />
      {reminders.length > 0 && <AppointmentReminders reminders={reminders} />}
    </div>
  );
}
