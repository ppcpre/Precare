"use client";

import { MoodFace, MOOD_LABEL } from "@/components/mood";
import { MOODS } from "@/db/schema";
import { cn } from "@/lib/cn";
import type { Mood } from "@/types";

/** 5 ปุ่มไอคอนเรียงแถว เลือกได้ 1 · กดซ้ำ = ยกเลิก */
export function MoodPicker({
  value,
  onChange,
}: {
  value: Mood | null;
  onChange: (m: Mood | null) => void;
}) {
  return (
    <div role="radiogroup" aria-label="อารมณ์วันนี้" className="flex gap-1.5">
      {MOODS.map((m) => {
        const on = m === value;
        return (
          <button
            key={m}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(on ? null : m)}
            className={cn(
              "flex h-[72px] min-h-0 flex-1 flex-col items-center justify-center gap-1.5 rounded-sm border transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brown-500",
              on ? "border-[1.5px] border-brown-500 bg-brown-100" : "border-cream-200 bg-cream-50",
            )}
          >
            <MoodFace mood={m} size={26} className={on ? "text-brown-700" : "text-ink-600"} />
            <span className={cn("text-[11px]", on ? "font-medium text-brown-900" : "text-ink-600")}>
              {MOOD_LABEL[m]}
            </span>
          </button>
        );
      })}
    </div>
  );
}
