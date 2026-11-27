import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Eye, Plus } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { listChildMeds } from "@/lib/child-care-queries";
import { can } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { MedList } from "@/components/baby/care/med-list";

export const metadata = { title: "ยาของลูก · Pre Care" };

/** D2 — ยาของลูก ทุกคนในบ้านเห็น · viewer ดูได้ บันทึกไม่ได้ */
export default async function ChildMedsPage({ params }: { params: Promise<{ id: string }> }) {
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
  const meds = await listChildMeds(ctx.db, ctx.familyId, child.id);
  const canWrite = can.writeRecords(ctx.role);
  const newHref = `/baby/${child.id}/meds/new`;

  return (
    <div className="flex flex-col gap-3 pb-24">
      <header className="flex items-center justify-between gap-2">
        <Link
          href={`/baby/${child.id}/log`}
          aria-label="กลับหน้าบันทึก"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} />
        </Link>
        <h1 className="truncate text-lg font-semibold text-ink-900">ยาของ{child.name}</h1>
        {canWrite ? (
          <Link
            href={newHref}
            aria-label="เพิ่มยาของลูก"
            className="-mr-2 flex size-11 items-center justify-center rounded-full text-brown-700 hover:bg-cream-100"
          >
            <Plus size={22} strokeWidth={2} />
          </Link>
        ) : (
          <span className="size-11" />
        )}
      </header>

      <div className="flex items-start gap-2 rounded-md border border-cream-200 bg-cream-100 p-3">
        <Eye size={16} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-400" />
        <p className="text-xs leading-relaxed text-ink-600">
          ยาของลูกทุกคนในบ้านเห็น ต่างจากยาของคุณเองที่เห็นแค่คุณ
        </p>
      </div>

      {meds.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 p-5 text-center">
          <p className="text-[15px] text-ink-900">ยังไม่มียาของลูก</p>
          <p className="text-[13px] text-ink-600">เพิ่มยาไว้ คนในบ้านจะเห็นว่าใครให้ไปแล้วเมื่อไหร่</p>
          {canWrite && <ButtonLink href={newHref}>เพิ่มยาของลูก</ButtonLink>}
        </Card>
      ) : (
        <MedList childId={child.id} meds={meds} meId={ctx.user.id} canWrite={canWrite} />
      )}
    </div>
  );
}
