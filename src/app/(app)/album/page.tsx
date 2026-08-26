import { redirect } from "next/navigation";
import { Image as ImageIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { requireFamilyContext } from "@/lib/queries";

export const metadata = { title: "อัลบั้ม · Pre Care" };

export default async function AlbumPage() {
  // Phase 2 ยังไม่มีของจริง แต่ด่านตรวจต้องมีตั้งแต่ตอนนี้
  // ไม่งั้นวันที่ใส่เนื้อหาจะลืมใส่
  try {
    await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold text-ink-900">อัลบั้ม</h1>
      <EmptyState
        icon={ImageIcon}
        title="อัลบั้มกำลังจะมา"
        description="เก็บภาพอัลตราซาวด์และความทรงจำของครอบครัวไว้ที่เดียว พร้อมใช้งานใน Phase 2"
      />
    </div>
  );
}
