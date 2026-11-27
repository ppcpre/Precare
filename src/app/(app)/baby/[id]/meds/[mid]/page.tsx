import { notFound, redirect } from "next/navigation";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { listChildMeds } from "@/lib/child-care-queries";
import { MedForm } from "@/components/baby/care/med-form";

export const metadata = { title: "แก้ยาของลูก · Pre Care" };

export default async function EditChildMedPage({ params }: { params: Promise<{ id: string; mid: string }> }) {
  const { id, mid } = await params;
  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect(`/baby/${id}/meds`);
  }
  const child = await getChild(ctx.db, ctx.familyId, id);
  if (!child) notFound();
  const med = (await listChildMeds(ctx.db, ctx.familyId, child.id)).find((m) => m.id === mid);
  if (!med) notFound();
  return <MedForm childId={child.id} med={med} />;
}
