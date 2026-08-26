import { redirect } from "next/navigation";
import { UploadSheet } from "@/components/album/upload-sheet";
import { requireFamilyContext } from "@/lib/queries";
import { getStorageUsage } from "@/lib/storage";

export const metadata = { title: "เพิ่มรูป · Pre Care" };

export default async function AlbumUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ logId?: string }>;
}) {
  const { logId } = await searchParams;

  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    redirect("/album");
  }

  const usage = await getStorageUsage(ctx.db);
  return <UploadSheet uploaderName={ctx.user.name} storageFull={usage.full} logId={logId} />;
}
