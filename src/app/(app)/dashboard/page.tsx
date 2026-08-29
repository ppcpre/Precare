import { redirect } from "next/navigation";
import { Plus, Eye } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { GestationHero, SetupPrompt } from "@/components/dashboard/hero";
import { NextAppointmentCard, RecentLogsCard } from "@/components/dashboard/cards";
import { WeeklyDevelopmentCard, WeeklySizeCard } from "@/components/dashboard/weekly";
import { weeklyContent } from "@/data/weekly-content";
import { getActiveKickSession, getDashboard, listKickSessions, requireFamilyContext } from "@/lib/queries";
import { KickCard } from "@/components/kicks/dashboard-card";
import { averageMs } from "@/lib/kicks";
import { can } from "@/lib/authz";

export const metadata = { title: "หน้าแรก · Pre Care" };

export default async function DashboardPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    // แยกให้ชัด อย่ากลืนทุก error เป็น onboarding ไม่งั้นดีบักไม่ออกว่าพังที่ไหน
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const { db, familyId, role } = ctx;
  const [data, activeKick, kickSessions] = await Promise.all([
    getDashboard(db, familyId),
    getActiveKickSession(db, familyId),
    listKickSessions(db, familyId, 10),
  ]);

  // now มาจาก getDashboard ไม่ใช่เรียก Date.now() ใน render
  // เพราะ react-hooks/purity ห้ามฟังก์ชัน impure ใน component แม้เป็น server component
  const { now } = data;

  const canWrite = can.writeRecords(role);
  // null เมื่ออายุครรภ์ยังไม่ถึง 4 สัปดาห์ หรือเลย 40 ไปแล้ว — การ์ดจะไม่ขึ้น
  const weekly = weeklyContent(data.ga?.weeks);

  return (
    <div className="flex flex-col gap-4">
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

          {weekly && <WeeklyDevelopmentCard content={weekly} />}
          <KickCard
            week={data.ga?.weeks ?? null}
            active={activeKick != null}
            lastDurationMs={kickSessions[0]?.durationMs ?? null}
            avgMs={averageMs(kickSessions)}
          />
        </div>

        <div className="flex flex-col gap-4">
          {weekly && <WeeklySizeCard content={weekly} />}
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
