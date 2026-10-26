import { redirect, notFound } from "next/navigation";
import {
  getChild,
  listChildPhotos,
  listMeasurements,
  listMilestones,
  requireFamilyContext,
} from "@/lib/queries";
import { familyMediaBase } from "@/lib/media-base";
import { can } from "@/lib/authz";
import { buildTimeline } from "@/lib/child-timeline";
import { ageLabel } from "@/lib/child-age";
import { localToday } from "@/lib/local-time";
import { TimelineGrid } from "@/components/baby/timeline-grid";
import { ChildExtras } from "@/components/baby/child-extras";
import { Fab } from "@/components/ui/fab";

export const metadata = { title: "สมุดรูปของลูก · Pre Care" };

export default async function BabyTimelinePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
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

  // getChild กรอง familyId ด้วย — id จาก URL ของครอบครัวอื่นจะได้ 404 ไม่ใช่ข้อมูล
  const child = await getChild(ctx.db, ctx.familyId, id);
  if (!child) notFound();

  const [items, measurements, milestones, mediaBase] = await Promise.all([
    listChildPhotos(ctx.db, ctx.familyId, child.id),
    listMeasurements(ctx.db, ctx.familyId, child.id),
    listMilestones(ctx.db, ctx.familyId, child.id),
    familyMediaBase(ctx.familyId),
  ]);

  const timeline = buildTimeline(child.birthDate, items);
  const canWrite = can.writeRecords(ctx.role);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <header className="flex items-baseline justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">{child.name}</h1>
        <span className="text-sm text-ink-600">{ageLabel(child.birthDate, localToday())}</span>
      </header>

      <p className="text-[13px] text-ink-600">
        เติมแล้ว{" "}
        <b className="text-ink-900 tabular-nums">
          {timeline.filled}/{timeline.total}
        </b>{" "}
        ช่อง · กดช่องว่างเพื่อเพิ่มรูปของช่วงนั้น
      </p>

      <TimelineGrid
        timeline={timeline}
        childId={child.id}
        mediaBase={mediaBase}
        canWrite={canWrite}
      />

      <ChildExtras
        child={{ id: child.id, name: child.name, birthDate: child.birthDate }}
        measurements={measurements}
        milestones={milestones}
        canWrite={canWrite}
      />

      {canWrite && (
        <Fab href={`/album/upload?childId=${child.id}`} label="เพิ่มรูปของลูก" />
      )}
    </div>
  );
}
