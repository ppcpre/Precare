import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { AlertCircle, Calendar, Download, Share2, User as UserIcon, Users, X } from "lucide-react";
import { RoleBadge, Badge } from "@/components/ui/badge";
import { PhotoActions } from "@/components/album/photo-actions";
import { PhotoTypeBadge } from "@/components/album/type-picker";
import { DownloadLink, ShareButton } from "@/components/album/share-button";
import { TYPE_LABEL } from "@/lib/photo-types";
import { getCoverPhotoId, getPhotoById, requireFamilyContext } from "@/lib/queries";
import { familyMediaBase } from "@/lib/media-base";
import { mediaUrl } from "@/lib/media-src";
import { can } from "@/lib/authz";
import { thaiDateFull, thaiDate } from "@/lib/format";
import { formatClip } from "@/lib/video";

export const metadata = { title: "ดูไฟล์ · Pre Care" };

/** ใหญ่กว่านี้ให้เบราว์เซอร์สตรีมลงดิสก์เอง แทนที่จะอ่านเข้าหน่วยความจำเพื่อแชร์ */
const SHARE_MAX_BYTES = 50 * 1024 ** 2;

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

  const [photo, coverPhotoId, mediaBase] = await Promise.all([
    getPhotoById(ctx.db, ctx.familyId, id),
    getCoverPhotoId(ctx.db, ctx.familyId),
    familyMediaBase(ctx.familyId),
  ]);
  if (!photo) notFound();

  return (
    <div className="-mx-4 -my-4 flex min-h-dvh flex-col bg-ink-900 md:-mx-12 md:-my-8">
      <header className="flex h-14 shrink-0 items-center justify-between px-4">
        <Link href="/album" aria-label="ปิด" className="flex size-10 items-center justify-center">
          <X size={22} strokeWidth={2} className="text-white" />
        </Link>
      </header>

      <div className="flex flex-1 items-center justify-center px-4 pb-2">
        {photo.mediaKind === "video" ? (
          /* controls ครบและ playsInline — บน iOS ถ้าไม่ใส่ playsInline
             การกดเล่นจะเด้งเป็นเครื่องเล่นเต็มจอของระบบแทนที่จะเล่นในหน้า
             poster ทำให้เห็นว่าคลิปนี้คืออะไรก่อนกด ไม่ใช่กล่องดำ */
          <video
            src={mediaUrl(mediaBase, photo.r2Key)}
            poster={photo.thumbKey ? mediaUrl(mediaBase, photo.thumbKey) : undefined}
            controls
            playsInline
            preload="metadata"
            className="max-h-[60dvh] w-full rounded-md bg-black object-contain"
          />
        ) : (
          /* eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2 ผ่าน route ที่เช็ค session */
          <img
            src={mediaUrl(mediaBase, photo.r2Key)}
            alt={photo.caption ?? "รูปในอัลบั้ม"}
            className="max-h-[60dvh] w-full rounded-md object-contain"
          />
        )}
      </div>

      <div className="flex flex-col gap-3.5 rounded-t-lg bg-cream-50 p-5">
        {/* wrap เพราะตัวเลือกประเภทกางออกมาต่อท้ายแถวนี้ ต้องมีที่ให้มันลงบรรทัดใหม่ */}
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-lg font-semibold text-ink-900">
            {photo.week != null ? `สัปดาห์ที่ ${photo.week}` : "ไม่ระบุสัปดาห์"}
          </h1>
          {photo.type === "receipt" ? (
            <Badge className="bg-brown-100 text-brown-900">{TYPE_LABEL[photo.type]}</Badge>
          ) : (
            <PhotoTypeBadge
              id={photo.id}
              type={photo.type}
              canEdit={can.writeRecords(ctx.role)}
            />
          )}
          {photo.pinned && <Badge>รูปเด่น</Badge>}
          {coverPhotoId === photo.id && <Badge>รูปหน้าปกหน้าแรก</Badge>}
          {photo.mediaKind === "video" && photo.durationMs != null && (
            <Badge>คลิป {formatClip(photo.durationMs)}</Badge>
          )}
        </div>

        {/* คลิปจากห้องตรวจมักติดเสียงหมอและคนอื่นที่ไม่ได้ยินยอมให้บันทึก
            เตือนตรงจุดที่จะแชร์ ไม่ใช่ซ่อนไว้ในหน้านโยบาย */}
        {photo.mediaKind === "video" && (
          <p className="flex items-start gap-2 rounded-md border border-cream-200 bg-cream-100 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
            <AlertCircle size={15} strokeWidth={1.9} className="mt-px shrink-0 text-ink-400" />
            คลิปอาจมีเสียงคนอื่นในห้องตรวจติดมาด้วย ก่อนแชร์ให้ฟังก่อน
          </p>
        )}

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

        {/**
          * แชร์ = ส่งตัวไฟล์ผ่านแผงของเครื่อง ไม่ใช่ลิงก์สาธารณะ
          *
          * แผงของเครื่องให้ทุกอย่างที่คนอยากได้จริง (เซฟลงคลังรูป ส่ง LINE
          * ส่งข้อความ AirDrop) โดยไฟล์ไม่ออกไปไหนนอกจากที่ผู้ใช้เลือกเอง
          * ส่วนลิงก์สาธารณะแปลว่าไฟล์สุขภาพเปิดได้โดยไม่ต้องล็อกอิน
          * ซึ่งเป็นการตัดสินใจที่ใหญ่เกินกว่าจะแถมมากับปุ่มแชร์
          *
          * ไฟล์ใหญ่เกิน SHARE_MAX_BYTES ไม่เข้าทางแชร์ เพราะต้องอ่านทั้งก้อน
          * เข้าหน่วยความจำก่อน — คลิป 500 MB ทำแท็บบนมือถือถูกฆ่าทิ้งได้
          */}
        {photo.sizeBytes != null && photo.sizeBytes > SHARE_MAX_BYTES ? (
          <DownloadLink r2Key={photo.r2Key} />
        ) : (
          <ShareButton
            r2Key={photo.r2Key}
            filename={`precare-${photo.takenAt.slice(0, 10)}${photo.week != null ? `-w${photo.week}` : ""}${photo.r2Key.slice(photo.r2Key.lastIndexOf("."))}`}
            title={photo.caption ?? "รูปจาก Pre Care"}
          />
        )}

        {can.writeRecords(ctx.role) && (
          <>
            <span className="h-px bg-cream-200" />
            <PhotoActions
              id={photo.id}
              pinned={photo.pinned}
              isCover={coverPhotoId === photo.id}
              canBeCover={
                photo.type !== "receipt" &&
                (photo.mediaKind !== "video" || photo.thumbKey != null)
              }
            />
          </>
        )}
      </div>
    </div>
  );
}
