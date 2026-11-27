import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { InviteForm } from "@/components/family/invite-form";
import { requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "เชิญสมาชิก · Pre Care" };

export default async function InvitePage() {
  try {
    // owner เท่านั้นที่เชิญได้ — ไม่ได้พึ่งแค่การซ่อนปุ่ม
    await requireFamilyContext("owner");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/family");
  }

  // สร้างลิงก์จาก host จริง จะได้ถูกต้องทั้ง localhost / dev / production
  const h = await headers();
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = `${proto}://${h.get("host")}`;

  return <InviteForm origin={origin} />;
}
