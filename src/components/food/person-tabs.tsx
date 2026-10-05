"use client";

import { useRouter } from "next/navigation";
import { Avatar } from "@/components/ui/avatar";
import { cn } from "@/lib/cn";

export interface PersonTab {
  userId: string;
  name: string;
  email: string;
  image: string | null;
  kcal: number;
  items: number;
  isMe: boolean;
  /** ยังเป็นสมาชิกอยู่หรือไม่ — คนที่ถูกนำออกแต่ยังมีบันทึกก็ต้องเห็นได้ */
  active: boolean;
  /** มีคนชื่อเดียวกันในแถบนี้ — ต้องเติมอะไรให้แยกออก */
  ambiguous: boolean;
}

/**
 * แถบเลือกคน — ป้ายเป็นชื่อจริงของสมาชิก ไม่ใช่คำว่า "ฉัน"
 *
 * ยอด kcal ของวันนั้นอยู่บนชิปของแต่ละคน ทำให้ "เห็นของทุกคน" จบในหน้าเดียว
 * ไม่ต้องกดไล่ดูทีละคน การกดชิปคือการเจาะดูรายละเอียด ไม่ใช่การไปหาตัวเลข
 *
 * ของตัวเองใช้ชื่อตัวเองเหมือนกับคนอื่น แต่อยู่หน้าสุดและมีป้าย "ฉัน" ต่อท้าย
 * เพราะพอทุกอันเป็นชื่อแล้ว ชื่อตัวเองก็ดูเหมือนชื่อคนอื่น ต้องมีอะไรบอกว่า
 * อันไหนคือแท็บที่เพิ่มเมนูได้
 *
 * เปลี่ยนคนด้วย ?u= ใน URL ไม่ใช่ state ในหน่วยความจำ — กดย้อนกลับจากหน้ากราฟ
 * แล้วต้องยังอยู่ที่คนเดิม และส่งลิงก์ให้กันได้
 */
export function PersonTabs({
  people,
  selected,
}: {
  people: PersonTab[];
  selected: string;
}) {
  const router = useRouter();

  /**
   * ประกอบ URL เองแทนการอ่าน useSearchParams — หน้านี้ไม่มี query อื่นให้รักษาไว้
   * และ useSearchParams ลากทั้งต้นไม้ของ client component ไปเป็น client-side
   * rendering ถ้าไม่ครอบ Suspense (ดู node_modules/next/dist/docs — use-search-params)
   */
  const go = (userId: string) => {
    // scroll: false — สลับคนแล้วหน้าไม่ควรกระโดดกลับไปบนสุด
    router.push(`/food?u=${encodeURIComponent(userId)}`, { scroll: false });
  };

  return (
    <div className="relative">
      {/* ไล่สีขอบขวาบอกว่ายังมีคนต่อ — ไม่งั้นชิปที่ถูกตัดครึ่งดูเหมือนขอบการ์ด
          โชว์เมื่อเกินสามคน ซึ่งคือจุดที่แถบล้นแน่นอนบนจอ 375px
          (วัดจากความกว้างจริงด้วย JS ก็ได้ แต่ต้องรอ layout รอบหนึ่งก่อน
          แล้วไล่สีจะกะพริบเข้ามาทีหลัง ซึ่งแย่กว่าการเดาผิดบนจอกว้างมากๆ) */}
      {people.length > 3 && (
        <span
          aria-hidden
          className="pointer-events-none absolute inset-y-0 right-0 w-8 bg-gradient-to-l from-cream-50 to-transparent"
        />
      )}
      <div
        role="tablist"
        aria-label="เลือกคนที่จะดู"
        className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {people.map((p) => {
          const on = p.userId === selected;
          return (
            <button
              key={p.userId}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => go(p.userId)}
              className={cn(
                "flex min-h-11 shrink-0 items-center gap-2 rounded-full py-1 pl-1 pr-3",
                on ? "bg-brown-700" : "border border-cream-200 bg-white",
              )}
            >
              <Avatar name={p.name} image={p.image} size={26} />
              <span className="flex flex-col items-start leading-tight">
                <span
                  className={cn(
                    "max-w-[7rem] truncate text-[13px]",
                    on ? "font-medium text-white" : "text-ink-900",
                  )}
                >
                  {p.name}
                  {/* ชื่อซ้ำกันได้จริงในครอบครัวเดียว ป้ายที่เป็นชื่อล้วนจะแยกไม่ออก
                    ด้วยตา เติมอักษรแรกของอีเมลเฉพาะชื่อที่ซ้ำ ไม่โชว์อีเมลเต็ม */}
                  {p.ambiguous && (
                    <span
                      className={cn(
                        "text-[10px]",
                        on ? "text-cream-200" : "text-ink-400",
                      )}
                    >
                      {" · "}
                      {p.email.charAt(0)}
                    </span>
                  )}
                  {p.isMe && (
                    <span
                      className={cn(
                        "text-[10px]",
                        on ? "text-cream-200" : "text-ink-400",
                      )}
                    >
                      {" ฉัน"}
                    </span>
                  )}
                </span>
                <span
                  className={cn(
                    "text-[11px]",
                    on ? "text-cream-200" : "text-ink-600",
                  )}
                >
                  {p.items === 0
                    ? "ยังไม่บันทึก"
                    : `${p.kcal.toLocaleString("th-TH")}${on ? " kcal" : ""}`}
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
