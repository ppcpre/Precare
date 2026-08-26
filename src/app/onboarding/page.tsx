import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "เริ่มต้นใช้งาน · Pre Care" };

export default async function OnboardingPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // มี family อยู่แล้วไม่ต้องทำซ้ำ
  if (user.activeFamilyId) redirect("/dashboard");

  return <OnboardingWizard defaultFamilyName={`ครอบครัว${user.name.split(" ")[0] ?? ""}`} />;
}
