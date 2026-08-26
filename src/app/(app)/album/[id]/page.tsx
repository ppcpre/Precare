import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Calendar, Download, Share2, User as UserIcon, Users, X } from "lucide-react";
import { RoleBadge, Badge } from "@/components/ui/badge";
import { PhotoActions } from "@/components/album/photo-actions";
import { getPhotoById, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";
import { thaiDateFull, thaiDate } from "@/lib/format";

export const metadata = { title: "ดูรูป · Pre Care" };

const TYPE_LABEL: Record<string, string> = {
  ultrasound: "อัลตราซาวด์",
  family: "ครอบครัว",
  other: "อื่นๆ",
};

export default async function PhotoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const photo = await getPhotoById(ctx.db, ctx.familyId, id);
  if (!photo) notFound();

  return (
    <div className="-mx-4 -my-4 flex min-h-dvh flex-col bg-ink-900 md:-mx-12 md:-my-8">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/album" aria-label="ปิด" className="flex size-10 items-center justify-center">
          <X size={22} strokeWidth={2} className="text-white" />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-2">
        {/* eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2 ผ่าน route ที่เช็ค session */}
        <img
          src={`/api/media/${photo.r2Key}`}
          alt={photo.caption ?? "รูปในอัลบั้ม"}
          className="max-h-[60dvh] w-full rounded-md object-contain"
        />
      </div>

      <div className="flex flex-col gap-3.5 rounded-t-lg bg-cream-50 p-5">
        <div className="flex items-center gap-2">
          <h1 className="text-lg font-semibold text-ink-900">
            {photo.week != null ? `สัปดาห์ที่ ${photo.week}` : "ไม่ระบุสัปดาห์"}
          </h1>
          <Badge className="bg-brown-100 text-brown-900">{TYPE_LABEL[photo.type]}</Badge>
          {photo.pinned && <Badge>รูปเด่น</Badge>}
        </div>

        <span className="flex items-center gap-1.5 text-xs text-ink-400">
          <Calendar size={13} strokeWidth={1.9} />
          ถ่ายเมื่อ {thaiDateFull(photo.takenAt)}
        </span>

        {photo.caption && (
          <p className="text-sm leading-relaxed text-ink-600">{photo.caption}</p>
        )}

        <span className="h-px bg-cream-200" />

        <div className="flex flex-col gap-1.5 text-xs text-ink-600">
          <span className="flex items-center gap-1.5">
            <UserIcon size={13} strokeWidth={1.9} className="text-ink-400" />
            เพิ่มโดย {photo.uploaderName}
          </span>
          <span className="flex items-center gap-1.5">
            <Calendar size={13} strokeWidth={1.9} className="text-ink-400" />
            เพิ่มเมื่อ {thaiDate(photo.createdAt)}
          </span>
        </div>

        <span className="h-px bg-cream-200" />

        {/* Phase 3 — วางโครงไว้ให้เห็นว่าจะมา แต่ disabled จริง ไม่หลอกให้กด */}
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center gap-2">
            <span className="font-medium text-ink-900">แชร์</span>
            <RoleBadge role="viewer" />
            <span className="text-xs text-ink-400">เร็วๆ นี้ · Phase 3</span>
          </div>
          <div className="flex gap-2">
            {[
              { icon: Share2, label: "แชร์ลิงก์" },
              { icon: Users, label: "ส่งให้ครอบครัว" },
              { icon: Download, label: "บันทึกรูป" },
            ].map(({ icon: Icon, label }) => (
              <span
                key={label}
                aria-disabled
                className="flex h-16 flex-1 flex-col items-center justify-center gap-1.5 rounded-[10px] border border-cream-200 bg-white opacity-55"
              >
                <Icon size={20} strokeWidth={1.8} className="text-ink-600" />
                <span className="text-[11px] text-ink-600">{label}</span>
              </span>
            ))}
          </div>
        </div>

        {can.writeRecords(ctx.role) && (
          <>
            <span className="h-px bg-cream-200" />
            <PhotoActions id={photo.id} pinned={photo.pinned} />
          </>
        )}
      </div>
    </div>
  );
}
