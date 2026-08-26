"use client";

import { cn } from "@/lib/cn";

/** Segmented control — ใช้ทั้ง toggle LMP/EDD และ tab กำลังจะถึง/ผ่านมาแล้ว */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="flex gap-1 rounded-[10px] bg-cream-100 p-1">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(o.value)}
            className={cn(
              "h-10 min-h-0 flex-1 rounded-sm px-2 text-sm transition-colors",
              "focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brown-500",
              on
                ? "bg-white font-medium text-brown-900 shadow-[var(--shadow-card)]"
                : "text-ink-600 hover:text-ink-900",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function ProgressDots({ step, total }: { step: number; total: number }) {
  return (
    <div className="flex justify-center gap-1.5" aria-label={`ขั้นที่ ${step + 1} จาก ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-2 rounded-full transition-all",
            i === step ? "w-6 bg-brown-700" : i < step ? "w-2 bg-brown-300" : "w-2 bg-cream-200",
          )}
        />
      ))}
    </div>
  );
}
