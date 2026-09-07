"use client";

import Link from "next/link";
import { ChevronRight, Plus } from "lucide-react";
import { PhotoCard } from "@/components/album/photo-card";
import { PhotoTile } from "@/components/album/photo-tile";
import { useAlbumView } from "@/components/album/view-toggle";
import { groupByMonthDay, type AlbumPhoto } from "@/lib/album-groups";
import { monthKeyLabel } from "@/lib/format";

const isVideo = (p: AlbumPhoto) => p.mediaKind === "video";

const DAY_FULL = "อาทิตย์ จันทร์ อังคาร พุธ พฤหัสบดี ศุกร์ เสาร์".split(" ");
const M_SHORT = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");

/** "2026-08-26" -> "26 ส.ค. · อังคาร" — ประกอบ Date จากตัวเลขตรงๆ ไม่ parse สตริง */
function dayLabel(key: string) {
  const [y, m, d] = key.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${d} ${M_SHORT[m - 1]} · ${DAY_FULL[dt.getDay()]}`;
}

/**
 * กลุ่มรูปในอัลบั้ม — เดือน แล้วแยกเป็นวัน
 *
 * เป็น client component เพราะมุมมองที่เลือกไว้เก็บใน localStorage
 * ซึ่ง server ไม่รู้ค่า (ดูเหตุผลเต็มใน view-toggle.tsx)
 *
 * หนึ่งวัน = หนึ่งแถวเลื่อนแนวนอน ไม่ตัดขึ้นบรรทัดใหม่
 * เพราะอัลบั้มจะยาวขึ้นเรื่อยๆ ถ้าวันที่มีรูปเยอะดันความสูงจนวันอื่นหลุดจอ
 * การหาว่า "วันนั้นถ่ายอะไรไว้" จะช้าลงทุกสัปดาห์
 * แถวเลื่อนทำให้หนึ่งวันสูงเท่ากันเสมอ ไม่ว่าจะมี 2 รูปหรือ 20 รูป
 */
export function PhotoGroups({ items, canWrite }: { items: AlbumPhoto[]; canWrite: boolean }) {
  const [view] = useAlbumView();
  const months = groupByMonthDay(items);

  // จำนวนรูปที่พอดีหน้าจอโดยประมาณ ใช้ตัดสินว่าจะขึ้นคำว่า "ไถดูเพิ่ม" ไหม
  // ใส่ทุกวันจะรกเปล่าๆ ในวันที่มีรูปไม่กี่ใบ
  const perScreen = view === "grid" ? 3 : 2;

  return (
    <div className="flex flex-col gap-3">
      {months.map((month) => (
        <section key={month.key} className="flex flex-col gap-2.5">
          <h2 className="flex items-center justify-between gap-2 pt-1">
            <span className="text-[15px] font-semibold text-ink-900">
              {monthKeyLabel(month.key)}
            </span>
            <span className="text-[11px] text-ink-400">
              {month.count} {month.days.some((d) => d.items.some(isVideo)) ? "ไฟล์" : "รูป"}
            </span>
          </h2>

          {month.days.map((day) => (
            <div key={day.key} className="flex flex-col gap-2">
              <h3 className="flex items-center justify-between gap-2">
                <span className="flex min-w-0 flex-wrap items-center gap-2">
                  <span aria-hidden className="size-[5px] shrink-0 rounded-full bg-brown-300" />
                  <span className="text-xs text-ink-600">{dayLabel(day.key)}</span>
                  {/* สัปดาห์ครรภ์เป็นแท็ก ไม่ใช่โครงของหน้า — ไม่มีก็ไม่แสดง */}
                  {day.week != null && (
                    <span className="rounded-[6px] bg-peach-100 px-1.5 py-px text-[10px] text-peach-700">
                      สัปดาห์ {day.week}
                    </span>
                  )}
                  <span className="text-[11px] text-ink-400">
                    {day.items.length} {day.items.some(isVideo) ? "ไฟล์" : "รูป"}
                  </span>
                </span>
                {day.items.length > perScreen && (
                  <span className="flex shrink-0 items-center gap-0.5 text-[10px] text-ink-400">
                    ไถดูเพิ่ม
                    <ChevronRight size={11} strokeWidth={2} />
                  </span>
                )}
              </h3>

              {/* snap แบบ proximity ไม่ใช่ mandatory — mandatory จะฝืนมือเวลาไถผ่านเร็วๆ */}
              <div className="-mx-4 flex snap-x snap-proximity gap-2 overflow-x-auto px-4 pb-1">
                {/* + อยู่หัวแถว ไม่ใช่ท้ายแถว — ท้ายแถวต้องไถผ่านของทั้งวันก่อนถึงจะเจอ
                    และกดแล้วได้วันที่ของแถวนั้นไปเลย ไม่ต้องมาเลือกวันเอง
                    ซึ่งเป็นขั้นที่กรอกผิดบ่อยที่สุด (คนเปิดอัลบั้มแล้วอยากเพิ่ม
                    มักเป็นการเติมของวันที่กำลังดูอยู่ ไม่ใช่ของวันนี้) */}
                {canWrite && (
                  <Link
                    href={`/album/upload?takenAt=${day.key}`}
                    aria-label={`เพิ่มลงวันที่ ${dayLabel(day.key)}`}
                    className="flex size-[108px] shrink-0 snap-start flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-brown-300 bg-cream-50 text-ink-600"
                  >
                    <Plus size={20} strokeWidth={2} className="text-brown-500" />
                    <span className="text-[11px]">เพิ่ม</span>
                  </Link>
                )}
                {day.items.map((p) =>
                  view === "grid" ? (
                    <span key={p.id} className="w-[108px] shrink-0 snap-start">
                      <PhotoTile {...p} />
                    </span>
                  ) : (
                    <span key={p.id} className="shrink-0 snap-start">
                      <PhotoCard {...p} />
                    </span>
                  ),
                )}
              </div>
            </div>
          ))}
        </section>
      ))}
    </div>
  );
}
