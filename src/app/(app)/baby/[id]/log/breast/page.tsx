import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { X } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { latestBabyLogs } from "@/lib/baby-queries";
import { can } from "@/lib/authz";
import { SIDE_LABEL, nextSide } from "@/lib/baby-log";
import { BreastTimer } from "@/components/baby/log/breast-timer";

export const metadata = { title: "ให้นมแม่ · Pre Care" };

export default async function BreastPage({ params }: { params: Promise<{ id: string }> }) {
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

  const { latest, open } = await latestBabyLogs(ctx.db, ctx.familyId, child.id);
  const running = open.find((o) => o.kind === "breast") ?? null;
  const last = running ? null : (latest.breast ?? null);
  const suggested = nextSide(last);

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <Link
          href={`/baby/${child.id}/log`}
          aria-label="ปิด"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <X size={22} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">ให้นมแม่ · {child.name}</h1>
        <span className="size-11" />
      </header>
      <BreastTimer
        // key ผูกกับรอบ — อีกเครื่องเริ่ม/หยุดแล้ว refresh จะได้สถานะใหม่ ไม่ใช่ค่าที่ค้างใน state
        key={running?.id ?? "none"}
        childId={child.id}
        childName={child.name}
        canWrite={can.writeRecords(ctx.role)}
        suggested={suggested}
        lastNote={
          last?.side && last.endedAt
            ? `ครั้งก่อนจบที่ข้าง${SIDE_LABEL[last.side]} (${last.endedAt.slice(11, 16)}) ครั้งนี้เริ่มที่${SIDE_LABEL[suggested!]}ก่อน`
            : null
        }
        initial={
          running
            ? {
                id: running.id,
                startedAt: running.startedAt,
                leftSec: running.leftSec ?? 0,
                rightSec: running.rightSec ?? 0,
                side: running.side ?? "left",
                sideStartedAt: running.sideStartedAt,
              }
            : null
        }
      />
    </div>
  );
}
