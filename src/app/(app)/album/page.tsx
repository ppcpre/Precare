import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, Image as ImageIcon, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { PhotoGroups } from "@/components/album/photo-groups";
import { AlbumViewToggle } from "@/components/album/view-toggle";
import { QuotaBar } from "@/components/album/quota-bar";
import { listPhotos, requireFamilyContext } from "@/lib/queries";
import { getStorageUsage } from "@/lib/storage";
import { can } from "@/lib/authz";

import { cn } from "@/lib/cn";

export const metadata = { title: "อัลบั้ม · Pre Care" };

const FILTERS = [
  { value: undefined, label: "ทั้งหมด" },
  { value: "ultrasound" as const, label: "อัลตราซาวด์" },
  { value: "family" as const, label: "ครอบครัว" },
  { value: "other" as const, label: "อื่นๆ" },
];

export default async function AlbumPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>;
}) {
  const { type } = await searchParams;
  const active = FILTERS.find((f) => f.value === type)?.value;

  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const [items, usage] = await Promise.all([
    listPhotos(ctx.db, ctx.familyId, active),
    getStorageUsage(ctx.db),
  ]);
  const canWrite = can.writeRecords(ctx.role);

  // จัดกลุ่มตามสัปดาห์ — items เรียงจากใหม่ไปเก่ามาแล้วจาก query
  const groups = new Map<string, typeof items>();
  for (const p of items) {
    const key = p.week != null ? `สัปดาห์ที่ ${p.week}` : "ไม่ระบุสัปดาห์";
    const arr = groups.get(key) ?? [];
    arr.push(p);
    groups.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-ink-900">อัลบั้ม</h1>
        {/* ครอบด้วย span แทนการใส่ hidden ลงบนปุ่มตรงๆ — cn() เป็นแค่ join
            ไม่ได้ merge class ที่ชนกัน ตัวปุ่มมี inline-flex เป็น base อยู่แล้ว
            พอเติม hidden เข้าไปทั้งคู่จะอยู่ใน class list แล้วลำดับใน CSS
            เป็นตัวตัดสิน ซึ่ง inline-flex ชนะ ปุ่มเลยโผล่บนมือถือคู่กับ FAB */}
        {canWrite && (
          <span className="hidden md:block">
            <ButtonLink href="/album/upload" variant="secondary">
              <Plus size={18} strokeWidth={2} />
              เพิ่มรูป
            </ButtonLink>
          </span>
        )}
      </header>

      {/* โควตาอยู่บนสุด — ต้องเห็นก่อนเลือกรูป ไม่ใช่หลังโดนปฏิเสธ */}
      <QuotaBar usage={usage} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.label}
            href={f.value ? `/album?type=${f.value}` : "/album"}
            className={cn(
              "shrink-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap",
              active === f.value
                ? "border-brown-100 bg-brown-100 text-brown-900"
                : "border-cream-200 bg-white text-ink-600",
            )}
          >
            {f.label}
          </Link>
        ))}
      </div>

      {items.length === 0 ? (
        <EmptyState
          icon={ImageIcon}
          title={active ? "ยังไม่มีรูปประเภทนี้" : "ยังไม่มีรูปในอัลบั้ม"}
          description="เก็บภาพอัลตราซาวด์และความทรงจำของครอบครัวไว้ที่เดียว เพิ่มได้จากที่นี่หรือตอนบันทึกสุขภาพ"
          action={canWrite ? <ButtonLink href="/album/upload">เพิ่มรูปแรก</ButtonLink> : undefined}
        />
      ) : (
        <>
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-cream-200 bg-white px-2.5 py-1 text-xs text-ink-600">
              <Clock size={13} strokeWidth={1.9} className="text-ink-400" />
              เรียงจากใหม่ไปเก่า
            </span>
            <AlbumViewToggle />
          </div>

          {/* จัดกลุ่มตามวันที่ ไม่ใช่ตามสัปดาห์ครรภ์
              หน้านี้จะถูกใช้กับบันทึกเรื่องอื่นที่ไม่ใช่การตั้งครรภ์ด้วย
              วันที่มีเสมอ ส่วนสัปดาห์มีเฉพาะตอนตั้งครรภ์ จึงเป็นแค่แท็ก */}
          <PhotoGroups items={items} />
        </>
      )}

      {canWrite && !usage.full && (
        <Link
          href="/album/upload"
          aria-label="เพิ่มรูป"
          className="fixed bottom-20 right-4 flex size-14 items-center justify-center rounded-full bg-brown-700 text-white shadow-[0_4px_12px_rgba(43,36,32,0.18)] md:hidden"
        >
          <Plus size={26} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
