import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Play } from "lucide-react";
import { getChild, listChildPhotos, requireFamilyContext } from "@/lib/queries";
import { familyMediaBase } from "@/lib/media-base";
import { mediaUrl } from "@/lib/media-src";
import { buildTimeline } from "@/lib/child-timeline";
import { ageLabel } from "@/lib/child-age";

export const metadata = { title: "สมุดรูปของลูก · Pre Care" };

/** รูปทั้งหมดในช่องอายุช่องเดียว — ต่อจากกริดบนหน้า timeline */
export default async function BabySlotPage({
  params,
}: {
  params: Promise<{ id: string; slot: string }>;
}) {
  const { id, slot } = await params;

  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const child = await getChild(ctx.db, ctx.familyId, id);
  if (!child) notFound();

  const [items, mediaBase] = await Promise.all([
    listChildPhotos(ctx.db, ctx.familyId, child.id),
    familyMediaBase(ctx.familyId),
  ]);

  const found = buildTimeline(child.birthDate, items).slots.find((s) => s.id === slot);
  // ช่องที่ไม่มีอยู่จริง (URL พิมพ์มั่ว) กับช่องที่ไม่มีรูป ต่างกัน — อันแรก 404
  if (!found) notFound();

  return (
    <div className="flex flex-col gap-3 pb-20">
      <header className="flex items-center gap-1">
        <Link
          href={`/baby/${child.id}`}
          aria-label="กลับไปสมุดรูป"
          className="-ml-2 flex size-9 items-center justify-center rounded-md text-ink-600"
        >
          <ChevronLeft size={22} />
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">{found.label}</h1>
        <span className="ml-auto text-sm text-ink-600">{child.name}</span>
      </header>

      <ol className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {found.items.map((it) => (
          <li key={it.id}>
            <Link href={`/album/${it.id}`} className="block">
              <span className="relative flex aspect-square items-center justify-center overflow-hidden rounded-lg bg-cream-100">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={mediaUrl(mediaBase, it.thumbKey ?? it.r2Key)}
                  alt={it.caption ?? ""}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
                {it.mediaKind === "video" && (
                  <Play
                    size={16}
                    className="absolute right-1 top-1 fill-white text-white drop-shadow"
                    aria-hidden
                  />
                )}
              </span>
              <span className="mt-1 block text-center text-[11px] text-ink-400">
                {ageLabel(child.birthDate, it.takenAt.slice(0, 10))}
              </span>
            </Link>
          </li>
        ))}
      </ol>
    </div>
  );
}
