import { notFound, redirect } from "next/navigation";
import { requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "ดูรูป · Pre Care" };

export default async function PhotoPage() {
  try {
    await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }
  // Phase 2 — ยังไม่มีตาราง photos ที่มีข้อมูล
  notFound();
}
