import { redirect } from "next/navigation";
import { AlertCircle, Footprints } from "lucide-react";
import { requireFamilyContext, getActiveKickSession, getDashboard, listKickSessions } from "@/lib/queries";
import { can } from "@/lib/authz";
import { cn } from "@/lib/cn";
import { thaiDate } from "@/lib/format";
import {
  START_WEEK,
  averageMs,
  formatMinutes,
  isSlowVsAverage,
  type SessionView,
} from "@/lib/kicks";
import { KickCounter } from "@/components/kicks/counter";
import { StartKickButton } from "@/components/kicks/start-button";

export const metadata = { title: "นับลูกดิ้น · Pre Care" };

export default async function KicksPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const [active, sessions, dash] = await Promise.all([
    getActiveKickSession(ctx.db, ctx.familyId),
    listKickSessions(ctx.db, ctx.familyId),
    getDashboard(ctx.db, ctx.familyId),
  ]);

  const canEdit = can.writeRecords(ctx.role);
  const week = dash.ga?.weeks ?? null;
  const avg = averageMs(sessions);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
          <Footprints size={22} strokeWidth={1.9} className="text-peach-700" />
          นับลูกดิ้น
        </h1>
      </header>

      {active ? (
        <KickCounter session={active} canEdit={canEdit} />
      ) : (
        <StartPanel week={week} avg={avg} sessions={sessions} canEdit={canEdit} />
      )}

      {/* ข้อความนี้ต้องอยู่ทุกสถานะ รวมถึงตอนยังไม่ถึงสัปดาห์ที่เริ่มนับ
          ตัวเลขที่ครบไม่ได้แปลว่าปลอดภัย และการยังไม่ถึงเวลานับก็ไม่ได้แปลว่าไม่ต้องสนใจ */}
      <p className="flex items-start gap-2 rounded-md border border-cream-300 bg-cream-100 px-4 py-3.5 text-[13px] leading-relaxed text-ink-600">
        <AlertCircle size={17} strokeWidth={1.9} className="mt-0.5 shrink-0 text-warning" />
        ถ้ารู้สึกว่าลูกดิ้นน้อยลงหรือผิดไปจากเดิม ให้ติดต่อโรงพยาบาลทันที ไม่ต้องรอนับให้ครบ
      </p>

      {sessions.length > 0 && <History sessions={sessions} avg={avg} />}
    </div>
  );
}

function StartPanel({
  week,
  avg,
  sessions,
  canEdit,
}: {
  week: number | null;
  avg: number | null;
  sessions: SessionView[];
  canEdit: boolean;
}) {
  // ก่อนสัปดาห์ที่กำหนด การดิ้นยังไม่เป็นเวลา นับไปก็ตีความไม่ได้
  if (week != null && week < START_WEEK) {
    const left = START_WEEK - week;
    return (
      <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-medium text-ink-900">ยังไม่ถึงช่วงที่นับได้</span>
          <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-600">
            เริ่มสัปดาห์ที่ {START_WEEK}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-600">
          ตอนนี้อายุครรภ์ {week} สัปดาห์ การดิ้นยังไม่เป็นเวลา จึงยังนับเป็นรูปแบบไม่ได้
          ระบบจะเปิดให้เริ่มนับเองเมื่อถึงสัปดาห์ที่ {START_WEEK}
        </p>
        <div className="flex items-center gap-2.5">
          <span aria-hidden className="h-1.5 flex-1 overflow-hidden rounded-full bg-cream-200">
            <span
              className="block h-full rounded-full bg-brown-300"
              style={{ width: `${Math.round((week / START_WEEK) * 100)}%` }}
            />
          </span>
          <span className="text-xs text-ink-400">อีก {left} สัปดาห์</span>
        </div>
      </div>
    );
  }

  const last = sessions[0];
  return (
    <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-[13px] leading-relaxed text-ink-600">
        แนะนำให้นับวันละครั้ง เวลาเดิมทุกวัน เพราะลูกมีช่วงตื่นเป็นเวลาของตัวเอง
      </p>

      {(last || avg != null) && (
        <div className="flex gap-2.5">
          <Cell label="ครั้งล่าสุด" value={last?.durationMs ? formatMinutes(last.durationMs) : "—"} />
          <Cell label="เฉลี่ยของคุณ" value={avg != null ? formatMinutes(avg) : "—"} />
        </div>
      )}

      {canEdit ? (
        <StartKickButton />
      ) : (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
          คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้
        </p>
      )}
    </div>
  );
}

function Cell({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-cream-200 bg-cream-50 px-3 py-2.5">
      <span className="text-xs text-ink-600">{label}</span>
      <span className="text-[17px] font-semibold text-ink-900">{value}</span>
    </div>
  );
}

function History({ sessions, avg }: { sessions: SessionView[]; avg: number | null }) {
  // แท่งเทียบกันเองในชุดที่แสดง เห็นได้ทันทีว่าวันไหนต่างจากวันอื่น
  const recent = sessions.slice(0, 7).reverse();
  const max = Math.max(...recent.map((s) => s.durationMs ?? 0), 1);

  return (
    <div className="flex flex-col gap-4">
      {recent.length > 1 && (
        <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-sm text-ink-600">เวลาที่ใช้จนครบ</span>
            {avg != null && (
              <span className="text-[11px] text-ink-400">เฉลี่ยของคุณ {formatMinutes(avg)}</span>
            )}
          </div>
          <div className="flex items-end gap-1">
            {recent.map((s) => {
              const slow = isSlowVsAverage(s, avg);
              const h = Math.max(4, Math.round(((s.durationMs ?? 0) / max) * 64));
              return (
                <span key={s.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <span className="flex h-16 items-end">
                    <span
                      aria-hidden
                      style={{ height: `${h}px` }}
                      className={cn("block w-5 rounded-[5px]", slow ? "bg-danger" : "bg-peach-500")}
                    />
                  </span>
                  <span className="text-[10px] text-ink-400">{s.startedAt.slice(8, 10)}</span>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-2">
        <span className="text-sm text-ink-600">รอบที่ผ่านมา</span>
        {sessions.map((s) => {
          const slow = isSlowVsAverage(s, avg);
          return (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border border-cream-200 bg-white p-3 shadow-[var(--shadow-card)]"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm text-ink-900">
                  {thaiDate(s.startedAt)} · {s.startedAt.slice(11, 16)}
                </span>
                {slow && <span className="text-[11px] text-danger">ช้ากว่าปกติของคุณ</span>}
                {s.note && <span className="truncate text-[11px] text-ink-400">{s.note}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-0.5">
                <span
                  className={cn(
                    "text-[15px] font-semibold tabular-nums",
                    slow ? "text-danger" : "text-ink-900",
                  )}
                >
                  {s.durationMs != null ? formatMinutes(s.durationMs) : "—"}
                </span>
                <span className="text-[11px] text-ink-400">{s.count} ครั้ง</span>
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
