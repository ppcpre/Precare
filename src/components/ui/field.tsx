"use client";

import { useId } from "react";
import { cn } from "@/lib/cn";

/** bg cream-50 / border cream-200 / focus 1.5px brown-500 / radius-sm / สูง 44px */
const BASE =
  "h-11 w-full rounded-sm border border-cream-200 bg-cream-50 px-3 text-base text-ink-900 " +
  "placeholder:text-ink-400 focus:border-[1.5px] focus:border-brown-500 focus:outline-none " +
  "disabled:text-ink-400";

export function Field({
  label,
  hint,
  error,
  suffix,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  hint?: string;
  error?: string;
  suffix?: string;
}) {
  const id = useId();
  const msg = error ?? hint;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-600">
        {label}
      </label>
      <div className="relative flex items-center">
        <input
          id={id}
          {...props}
          aria-invalid={Boolean(error)}
          aria-describedby={msg ? `${id}-msg` : undefined}
          className={cn(BASE, error && "border-[1.5px] border-danger", suffix && "pr-14", className)}
        />
        {suffix && (
          <span className="pointer-events-none absolute right-3 text-sm text-ink-600">{suffix}</span>
        )}
      </div>
      {msg && (
        <p id={`${id}-msg`} className={cn("text-xs", error ? "text-danger" : "text-ink-400")}>
          {msg}
        </p>
      )}
    </div>
  );
}

export function Textarea({
  label,
  className,
  ...props
}: React.TextareaHTMLAttributes<HTMLTextAreaElement> & { label: string }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-ink-600">
        {label}
      </label>
      <textarea
        id={id}
        rows={4}
        {...props}
        className={cn(
          "w-full rounded-sm border border-cream-200 bg-cream-50 p-3 text-base text-ink-900",
          "placeholder:text-ink-400 focus:border-[1.5px] focus:border-brown-500 focus:outline-none",
          className,
        )}
      />
    </div>
  );
}
