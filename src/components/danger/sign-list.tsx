"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { DangerSection, DangerSign } from "@/data/danger-signs";
import { cn } from "@/lib/cn";

/**
 * รายการอาการหนึ่งหมวด
 *
 * พับไว้หมดแล้วกดทีละอัน — ถ้ากางหมดจะยาวเกินสามหน้าจอ และตอนตกใจไม่มีใคร
 * อ่านกำแพงข้อความ อาการที่ไม่มีข้อย่อย (สโตรค เด็กเล็ก) แสดงเป็นบรรทัดเฉยๆ
 * ไม่ทำเป็นปุ่มที่กดแล้วไม่มีอะไรเกิดขึ้น
 *
 * ขนาดตัวอักษรใหญ่กว่าหน้าอื่นในแอปโดยตั้งใจ (17–18px เทียบกับ 13–15px)
 * เพราะคนเปิดมาตอนตกใจ มือสั่น และอาจเป็นผู้สูงอายุที่สายตายาว
 */
export function SignList({
  section,
  signs,
}: {
  section: DangerSection;
  signs: DangerSign[];
}) {
  const expandable = signs.some((s) => s.details.length > 0);

  return (
    <section
      className={cn(
        "flex flex-col gap-2 rounded-xl bg-white p-4",
        section.urgent
          ? "border-2 border-danger-strong"
          : "border border-cream-200",
      )}
    >
      <h2 className="text-xl font-bold text-ink-900">{section.title}</h2>
      {section.note && (
        <p className="text-[15px] leading-relaxed text-ink-600">{section.note}</p>
      )}

      <ul className={cn("flex flex-col", expandable ? "gap-1.5" : "gap-2")}>
        {signs.map((sign) =>
          sign.details.length > 0 ? (
            <li key={sign.id}>
              <Expandable sign={sign} />
            </li>
          ) : (
            <li key={sign.id} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-2 size-2 shrink-0 rounded-full bg-peach-700"
              />
              <span className="text-[17px] font-medium leading-relaxed text-ink-900">
                {sign.label}
              </span>
            </li>
          ),
        )}
      </ul>

      {/* `action` คือสิ่งที่ต้องทำ ไม่ใช่คำอธิบาย — ไม่ตัดทิ้งตอนทำหน้าให้กระชับ */}
      {section.action && (
        <p className="rounded-[10px] bg-peach-100 px-3.5 py-3 text-base font-semibold leading-relaxed text-ink-900">
          {section.action}
        </p>
      )}
    </section>
  );
}

function Expandable({ sign }: { sign: DangerSign }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex min-h-16 w-full items-center gap-3 rounded-xl border border-cream-200 bg-cream-50 px-3.5 py-2.5 text-left"
      >
        <span className="flex-1 text-[18px] font-semibold leading-snug text-ink-900">
          {sign.label}
        </span>
        <ChevronDown
          size={22}
          strokeWidth={2.2}
          aria-hidden
          className={cn("shrink-0 text-ink-600 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <ul className="flex flex-col gap-2.5 px-3.5 pb-3 pt-2.5">
          {sign.details.map((d) => (
            <li key={d} className="flex items-start gap-2.5">
              <span
                aria-hidden
                className="mt-2 size-1.5 shrink-0 rounded-full bg-peach-700"
              />
              <span className="text-[17px] leading-relaxed text-ink-900">{d}</span>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
