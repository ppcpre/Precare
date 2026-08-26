import { redirect } from "next/navigation";
import { ProfileEditForm } from "@/components/profile/edit-form";
import { getSessionUser } from "@/lib/session";
import { getDb } from "@/db";
import { getStorageUsage } from "@/lib/storage";

export const metadata = { title: "แก้ไขโปรไฟล์ · Health Care" };

export default async function ProfileEditPage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const usage = await getStorageUsage(await getDb());
  return (
    <ProfileEditForm
      name={user.name}
      email={user.email}
      image={user.image}
      storageFull={usage.full}
    />
  );
}
