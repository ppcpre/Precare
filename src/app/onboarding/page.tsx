import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { OnboardingWizard } from "./wizard";

export const metadata = { title: "เริ่มต้นใช้งาน · Pre Care" };

export default async function OnboardingPage() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect("/login");
  // มี family อยู่แล้วไม่ต้องทำซ้ำ
  if (session.user.activeFamilyId) redirect("/dashboard");

  return <OnboardingWizard defaultFamilyName={`ครอบครัว${session.user.name.split(" ")[0] ?? ""}`} />;
}
