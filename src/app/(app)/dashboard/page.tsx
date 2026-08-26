import { redirect } from "next/navigation";
import { Plus, Eye } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { DashboardTopBar } from "@/components/app-topbar";
import { GestationHero, SetupPrompt } from "@/components/dashboard/hero";
import { NextAppointmentCard, RecentLogsCard } from "@/components/dashboard/cards";
import { getDashboard, getFamily, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";
import { daysFromNow } from "@/components/ui/badge";

export const metadata = { title: "หน้าแรก · Pre Care" };

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch {
    // ยังไม่มี family -> ต้องผ่าน onboarding ก่อน
    redirect("/onboarding");
  }

  const { db, user, familyId, role } = ctx;
  const [data, family] = await Promise.all([getDashboard(db, familyId), getFamily(db, familyId)]);

  // now มาจาก getDashboard ไม่ใช่เรียก Date.now() ใน render
  // เพราะ react-hooks/purity ห้ามฟังก์ชัน impure ใน component แม้เป็น server component
  const { now } = data;
  const soon =
    data.nextAppointment != null && daysFromNow(data.nextAppointment.apptDatetime, now) <= 1;

  const canWrite = can.writeRecords(role);

  return (
    <div className="flex flex-col gap-4">
      <DashboardTopBar
        userName={user.name}
        userImage={user.image}
        familyName={family?.name ?? "ครอบครัว"}
        hasSoonAppointment={soon}
      />

      {/* viewer เห็นแถบบอกสิทธิ์ครั้งแรก จะได้ไม่สงสัยว่าทำไมไม่มีปุ่มเพิ่ม */}
      {role === "viewer" && (
        <p className="flex items-center gap-2 rounded-md bg-cream-100 px-4 py-2.5 text-[13px] text-ink-600">
          <Eye size={16} strokeWidth={1.9} />
          คุณมีสิทธิ์<span className="font-medium text-ink-900">ดูอย่างเดียว</span>ในครอบครัวนี้
        </p>
      )}

      <div className="flex flex-col gap-4 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-4">
          {data.ga ? (
            <GestationHero
              ga={data.ga}
              daysLeft={data.daysLeft}
              dueDate={data.profile?.dueDate ?? null}
            />
          ) : (
            <SetupPrompt canEdit={can.editPregnancy(role)} />
          )}
        </div>

        <div className="flex flex-col gap-4">
          <NextAppointmentCard appt={data.nextAppointment} now={now} />
          <RecentLogsCard logs={data.recentLogs} />
        </div>
      </div>

      {/* ซ่อนทั้ง block ถ้า viewer — ไม่ใช่แค่ disabled ตาม design principle ข้อ 5 */}
      {canWrite && (
        <div className="flex gap-2.5">
          <ButtonLink href="/health/new" variant="secondary" full>
            <Plus size={18} strokeWidth={2} />
            บันทึกสุขภาพ
          </ButtonLink>
          <ButtonLink href="/appointments/new" variant="secondary" full>
            <Plus size={18} strokeWidth={2} />
            เพิ่มนัดหมาย
          </ButtonLink>
        </div>
      )}
    </div>
  );
}
