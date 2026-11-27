import { redirect } from "next/navigation";
import { Plus, Eye } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { GestationHero, PostpartumCard, SetupPrompt } from "@/components/dashboard/hero";
import { NextAppointmentCard, RecentLogsCard, FoodTodayCard } from "@/components/dashboard/cards";
import { WeeklyBabyCard } from "@/components/dashboard/weekly";
import { weeklyContent } from "@/data/weekly-content";
import {
  countOpenQuestions,
  getActiveKickSession,
  getActiveLaborSession,
  getDashboard,
  listKickSessions,
  requireFamilyContext,
} from "@/lib/queries";
import { KickCard } from "@/components/kicks/dashboard-card";
import { LaborCard } from "@/components/labor/dashboard-card";
import { averageMs } from "@/lib/kicks";
import { can } from "@/lib/authz";
import { familyMediaBase } from "@/lib/media-base";
import { listChildren } from "@/lib/queries";
import { latestBabyLogs, listBabyLogs, listMyReminders } from "@/lib/baby-queries";
import { addSeconds, summarizeDay } from "@/lib/baby-log";
import { localNowIso } from "@/lib/local-time";
import { BabyCard, type BabyCardData } from "@/components/baby/log/baby-card";
import { ChildSwitcher } from "@/components/baby/log/child-switcher";

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

  const { db, familyId, role, user } = ctx;
  const [data, activeKick, kickSessions, openQuestions, activeLabor, mediaBase, kids] =
    await Promise.all([
    getDashboard(db, familyId, user.id),
    getActiveKickSession(db, familyId),
    listKickSessions(db, familyId, 10),
    countOpenQuestions(db, familyId),
    getActiveLaborSession(db, familyId),
    familyMediaBase(familyId),
    listChildren(db, familyId),
  ]);

  // now มาจาก getDashboard ไม่ใช่เรียก Date.now() ใน render
  // เพราะ react-hooks/purity ห้ามฟังก์ชัน impure ใน component แม้เป็น server component
  const { now } = data;

  const canWrite = can.writeRecords(role);

  // การ์ดลูก — เฉพาะเมื่อมีคนกดเพิ่มลูกแล้ว ห้ามเดาจากวันคาดคลอด
  const nowIso = localNowIso();
  const today = nowIso.slice(0, 10);
  const dayFrom = `${today}T00:00:00`;
  const babies: BabyCardData[] = await Promise.all(
    kids.map(async (k) => {
      const [{ latest }, rows, reminders] = await Promise.all([
        latestBabyLogs(db, familyId, k.id),
        listBabyLogs(db, familyId, k.id, dayFrom, addSeconds(dayFrom, 86_400)),
        listMyReminders(db, familyId, user.id, k.id),
      ]);
      return {
        ...k,
        latest,
        summary: summarizeDay(rows, today, nowIso),
        reminded: reminders.filter((r) => r.active).map((r) => r.kind),
      };
    }),
  );
  // null เมื่ออายุครรภ์ยังไม่ถึง 4 สัปดาห์ หรือเลย 40 ไปแล้ว — การ์ดจะไม่ขึ้น
  const weekly = weeklyContent(data.ga?.weeks);

  return (
    <div className="flex flex-col gap-3">
      {/* viewer เห็นแถบบอกสิทธิ์ครั้งแรก จะได้ไม่สงสัยว่าทำไมไม่มีปุ่มเพิ่ม */}
      {role === "viewer" && (
        <p className="flex items-center gap-2 rounded-md bg-cream-100 px-4 py-2.5 text-[13px] text-ink-600">
          <Eye size={16} strokeWidth={1.9} />
          คุณมีสิทธิ์<span className="font-medium text-ink-900">ดูอย่างเดียว</span>ในครอบครัวนี้
        </p>
      )}

      <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[2fr_1fr] lg:items-start">
        <div className="flex flex-col gap-3">
          {babies.length === 1 && <BabyCard child={babies[0]} today={today} canWrite={canWrite} />}
          {babies.length > 1 && (
            <ChildSwitcher
              tabs={babies.map((b) => ({
                id: b.id,
                name: b.name,
                status:
                  b.latest.sleep?.endedAt === null
                    ? "กำลังนอน"
                    : b.latest.breast?.endedAt === null
                      ? "กำลังกินนม"
                      : "",
              }))}
            >
              {babies.map((b) => (
                <BabyCard key={b.id} child={b} today={today} canWrite={canWrite} />
              ))}
            </ChildSwitcher>
          )}

          {data.ga ? (
            <GestationHero
              ga={data.ga}
              daysLeft={data.daysLeft}
              dueDate={data.profile?.dueDate ?? null}
              cover={data.cover}
              canEdit={canWrite}
              mediaBase={mediaBase}
            />
          ) : babies.length > 0 ? null : data.postpartum ? (
            // หลังคลอดต้องไม่ขึ้น "ตั้งค่าวันตั้งครรภ์" — ข้อมูลตั้งไว้แล้ว
            // แค่จบรอบไปแล้ว ถ้าขึ้นแบบนั้นจะเหมือนแอปลืมทุกอย่างที่เพิ่งผ่านมา
            <PostpartumCard canWrite={canWrite} />
          ) : (
            <SetupPrompt canEdit={can.editPregnancy(role)} />
          )}

          {weekly && <WeeklyBabyCard content={weekly} />}
          <KickCard
            week={data.ga?.weeks ?? null}
            active={activeKick != null}
            lastDurationMs={kickSessions[0]?.durationMs ?? null}
            avgMs={averageMs(kickSessions)}
          />
          <LaborCard week={data.ga?.weeks ?? null} active={activeLabor != null} />
        </div>

        <div className="flex flex-col gap-3">
          <NextAppointmentCard appt={data.nextAppointment} now={now} openQuestions={openQuestions} />
          <RecentLogsCard logs={data.recentLogs} />
          <FoodTodayCard food={data.food} />
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
