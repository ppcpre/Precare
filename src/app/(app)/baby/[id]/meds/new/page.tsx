import { notFound, redirect } from "next/navigation";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { MedForm } from "@/components/baby/care/med-form";

export const metadata = { title: "เพิ่มยาของลูก · Pre Care" };

export default async function NewChildMedPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    // viewer เพิ่มยาไม่ได้ — กลับไปหน้ายา ไม่ใช่หน้า error
    redirect(`/baby/${id}/meds`);
  }
  const child = await getChild(ctx.db, ctx.familyId, id);
  if (!child) notFound();
  return <MedForm childId={child.id} med={null} />;
}
