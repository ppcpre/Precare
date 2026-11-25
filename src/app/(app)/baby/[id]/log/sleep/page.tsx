import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { latestBabyLogs, listBabyLogs } from "@/lib/baby-queries";
import { can } from "@/lib/authz";
import { localNowIso } from "@/lib/local-time";
import { addSeconds, durationSec, summarizeDay } from "@/lib/baby-log";
import { SleepTimer } from "@/components/baby/log/sleep-timer";

export const metadata = { title: "นอน · Pre Care" };

export default async function SleepPage({ params }: { params: Promise<{ id: string }> }) {
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

  const nowIso = localNowIso();
  const day = nowIso.slice(0, 10);
  const from = `${day}T00:00:00`;
  const [{ open }, rows] = await Promise.all([
    latestBabyLogs(ctx.db, ctx.familyId, child.id),
    listBabyLogs(ctx.db, ctx.familyId, child.id, from, addSeconds(from, 86_400)),
  ]);
  const running = open.find((o) => o.kind === "sleep") ?? null;
  // ไม่นับรอบที่กำลังนอน — client บวกเวลาสดเข้าไปเอง
  const done = rows.filter((r) => r.kind === "sleep" && r.endedAt !== null);
  const todaySec = summarizeDay(done, day, nowIso).sleep.sec;
  const longestSec = done.reduce((m, r) => Math.max(m, durationSec(r, nowIso)), 0);

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <Link
          href={`/baby/${child.id}/log`}
          aria-label="กลับ"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">นอน · {child.name}</h1>
        <span className="size-11" />
      </header>
      <SleepTimer
        key={running?.id ?? "none"}
        childId={child.id}
        canWrite={can.writeRecords(ctx.role)}
        open={running ? { id: running.id, startedAt: running.startedAt } : null}
        startedByOther={
          running && running.createdBy !== ctx.user.id ? (running.createdByName ?? "สมาชิกอีกคน") : null
        }
        todaySec={todaySec}
        longestSec={longestSec}
      />
    </div>
  );
}
