import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";

export default async function Home() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });

  if (!session) redirect("/login");
  // MVP บังคับ 1 user = 1 active family — ยังไม่มี = ต้องผ่าน onboarding ก่อน
  redirect(session.user.activeFamilyId ? "/dashboard" : "/onboarding");
}
