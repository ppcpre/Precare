import { redirect } from "next/navigation";
import { UploadSheet } from "@/components/album/upload-sheet";
import { requireFamilyContext } from "@/lib/queries";
import { getStorageUsage } from "@/lib/storage";

export const metadata = { title: "เพิ่มไฟล์ · Pre Care" };

export default async function AlbumUploadPage({
  searchParams,
}: {
  searchParams: Promise<{ logId?: string; appointmentId?: string; takenAt?: string }>;
}) {
  const { logId, appointmentId, takenAt } = await searchParams;

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
  // takenAt มาจากปุ่ม + ของแต่ละวันในอัลบั้ม — รับเฉพาะรูปแบบวันที่
  // ไม่งั้นค่าที่พิมพ์มามั่วๆ จะไปโผล่ในช่องวันที่แล้วบันทึกไม่ผ่านโดยไม่บอกสาเหตุ
  const initialTakenAt = takenAt && /^\d{4}-\d{2}-\d{2}$/.test(takenAt) ? takenAt : undefined;
  return (
    <UploadSheet
      uploaderName={ctx.user.name}
      storageFull={usage.full}
      logId={logId}
      appointmentId={appointmentId}
      initialTakenAt={initialTakenAt}
    />
  );
}
