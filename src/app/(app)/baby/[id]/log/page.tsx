import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, ChevronRight, Images } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { latestBabyLogs, listBabyLogs } from "@/lib/baby-queries";
import { can } from "@/lib/authz";
import { ageLabel } from "@/lib/child-age";
import { isValidDay, localNowIso, shiftDay } from "@/lib/local-time";
import { addSeconds, secondsBetween, stripMarks, summarizeDay } from "@/lib/baby-log";
import { thaiDate } from "@/lib/format";
import { QuickGrid } from "@/components/baby/log/quick-grid";
import { DayStrip } from "@/components/baby/log/day-strip";
import { DaySummaryCard } from "@/components/baby/log/day-summary";
import { RecentList } from "@/components/baby/log/recent-list";

export const metadata = { title: "บันทึกประจำวันของลูก · Pre Care" };

/**
 * B1 — หน้าวันนี้ของลูก
 *
 * วันอยู่ใน URL (?d=) เหมือนหน้าอาหาร: กดย้อนกลับจากหน้าจับเวลาแล้วต้องอยู่วันเดิม
 */
export default async function BabyLogPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ d?: string }>;
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

  const nowIso = localNowIso();
  const today = nowIso.slice(0, 10);
  const day = isValidDay(sp.d) && sp.d <= today ? sp.d : today;
  const isToday = day === today;
  const from = `${day}T00:00:00`;
  const to = addSeconds(from, 86_400);

  const [rows, { latest }] = await Promise.all([
    listBabyLogs(ctx.db, ctx.familyId, child.id, from, to),
    latestBabyLogs(ctx.db, ctx.familyId, child.id),
  ]);

  // ดูวันเก่า = ตัดที่สิ้นวันนั้น ไม่ใช่ตอนนี้ — ไม่งั้นรอบที่ค้างยาวผิดวัน
  const until = isToday ? nowIso : to;
  const summary = summarizeDay(rows, day, until);
  const marks = stripMarks(rows, day, until);
  const dayRows = rows.filter((r) => r.startedAt.slice(0, 10) === day);
  const canWrite = can.writeRecords(ctx.role);
  const base = `/baby/${child.id}/log`;
  const dayHref = (d: string) => (d === today ? base : `${base}?d=${d}`);

  return (
    <div className="flex flex-col gap-3 pb-24">
      <header className="flex items-center justify-between gap-2">
        <Link
          href="/dashboard"
          aria-label="กลับหน้าแรก"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} />
        </Link>
        <h1 className="truncate text-xl font-semibold text-ink-900">{child.name}</h1>
        <Link
          href={`/baby/${child.id}`}
          aria-label={`สมุดรูปของ${child.name}`}
          className="-mr-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <Images size={20} strokeWidth={1.9} />
        </Link>
      </header>
      <p className="-mt-2 text-center text-[13px] text-ink-600">{ageLabel(child.birthDate, today)}</p>

      <QuickGrid childId={child.id} latest={latest} canWrite={canWrite} />

      <nav className="flex items-center justify-between" aria-label="เลือกวัน">
        <Link
          href={dayHref(shiftDay(day, -1))}
          scroll={false}
          aria-label="วันก่อนหน้า"
          className="flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={19} />
        </Link>
        <span className="text-[15px] font-medium text-ink-900">
          {isToday ? "วันนี้ · " : ""}
          {thaiDate(day)}
        </span>
        {isToday ? (
          <span className="size-11" />
        ) : (
          <Link
            href={dayHref(shiftDay(day, 1))}
            scroll={false}
            aria-label="วันถัดไป"
            className="flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
          >
            <ChevronRight size={19} />
          </Link>
        )}
      </nav>

      <DayStrip marks={marks} nowMin={isToday ? secondsBetween(from, nowIso) / 60 : null} />
      <DaySummaryCard s={summary} title={isToday ? "สรุปวันนี้" : `สรุป ${thaiDate(day)}`} />
      <RecentList rows={dayRows} meId={ctx.user.id} canWrite={canWrite} />
    </div>
  );
}
