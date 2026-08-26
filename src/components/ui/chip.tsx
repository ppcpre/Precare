"use client";

import { cn } from "@/lib/cn";

/** ชิปเลือกได้ — ใช้ทั้ง filter bar และ multi-select อาการ */
export function Chip({
  active,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      {...props}
      className={cn(
        "h-auto min-h-0 rounded-full border px-3.5 py-1.5 text-sm whitespace-nowrap transition-colors",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown-500",
        active
          ? "border-brown-100 bg-brown-100 text-brown-900"
          : "border-cream-200 bg-white text-ink-600 hover:bg-cream-50",
        className,
      )}
    />
  );
}

export function ChipMultiSelect({
  options,
  value,
  onChange,
}: {
  options: readonly string[];
  value: string[];
  onChange: (next: string[]) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value.includes(o);
        return (
          <Chip
            key={o}
            active={on}
            onClick={() => onChange(on ? value.filter((x) => x !== o) : [...value, o])}
          >
            {o}
          </Chip>
        );
      })}
    </div>
  );
}
