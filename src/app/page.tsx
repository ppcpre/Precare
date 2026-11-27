import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";

export default async function Home() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // MVP บังคับ 1 user = 1 active family — ยังไม่มี = ต้องผ่าน onboarding ก่อน
  redirect(user.activeFamilyId ? "/dashboard" : "/onboarding");
}
