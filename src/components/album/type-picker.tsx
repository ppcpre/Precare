"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Check, ChevronDown } from "lucide-react";
import { setPhotoType } from "@/actions/photos";
import { ALBUM_TYPE_OPTIONS, TYPE_LABEL } from "@/lib/photo-types";
import type { AlbumPhotoType } from "@/db/schema";
import { cn } from "@/lib/cn";

/**
 * ป้ายประเภทที่กดแก้ได้เลย
 *
 * กดที่ป้ายแล้วตัวเลือกกางออกตรงนั้น ไม่มีแถวตัวเลือกกินที่ค้างไว้ตลอดเวลา
 * ทั้งที่คนส่วนใหญ่เปิดหน้านี้มาเพื่อ "ดูรูป" ไม่ใช่มาแก้ประเภท
 *
 * พื้นที่กดของป้ายสูง 44px ตาม design-system.md ข้อ 4 แต่หักระยะกลับด้วย
 * -my-3 เพื่อไม่ให้แถวหัวเรื่องสูงขึ้นตาม — ตัวป้ายที่เห็นยังเท่าเดิม
 * ส่วนที่โตคือพื้นที่รับนิ้วซึ่งมองไม่เห็น
 */
export function PhotoTypeBadge({
  id,
  type,
  canEdit,
}: {
  id: string;
  type: AlbumPhotoType;
  canEdit: boolean;
}) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const act = useAction(setPhotoType, {
    onSuccess: () => {
      setOpen(false);
      router.refresh();
    },
  });

  // ระหว่างรอ server ตอบ ให้ป้ายขึ้นค่าที่เพิ่งกดไปก่อน ไม่งั้นจะรู้สึกว่ากดไม่ติด
  const current = act.isPending ? (act.input?.type ?? type) : type;
  const badge = "rounded-[6px] bg-brown-100 px-2 py-0.5 text-[11px] text-brown-900";

  if (!canEdit) return <span className={badge}>{TYPE_LABEL[current]}</span>;

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-label={`ประเภท: ${TYPE_LABEL[current]} — แตะเพื่อเปลี่ยน`}
        onClick={() => setOpen((v) => !v)}
        className="-my-3 flex min-h-11 items-center py-3"
      >
        <span className={cn(badge, "flex items-center gap-1")}>
          {TYPE_LABEL[current]}
          <ChevronDown
            size={12}
            strokeWidth={2.2}
            className={cn("transition-transform", open && "rotate-180")}
          />
        </span>
      </button>

      {open && (
        <div className="flex w-full flex-wrap gap-2 pt-1">
          {ALBUM_TYPE_OPTIONS.map((o) => {
            const active = o.value === current;
            return (
              <button
                key={o.value}
                type="button"
                aria-pressed={active}
                disabled={act.isPending}
                onClick={() => (active ? setOpen(false) : act.execute({ id, type: o.value }))}
                className={cn(
                  "flex h-11 items-center gap-1.5 rounded-md border px-3.5 text-sm",
                  active
                    ? "border-brown-700 bg-brown-700 font-medium text-white"
                    : "border-cream-200 bg-white text-ink-900",
                )}
              >
                {active && <Check size={15} strokeWidth={2.2} />}
                {o.label}
              </button>
            );
          })}
        </div>
      )}

      {act.result.serverError && (
        <p className="w-full text-xs text-danger">{act.result.serverError}</p>
      )}
    </>
  );
}
