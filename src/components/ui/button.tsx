import Link from "next/link";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "danger";

/** สเปกจาก design-system.md §4 — สูง 44px, padding-x 20px, radius 12px */
const VARIANTS: Record<Variant, string> = {
  primary: "bg-brown-700 text-white hover:bg-brown-900 disabled:bg-cream-200 disabled:text-ink-400",
  secondary:
    "bg-white text-brown-700 border border-brown-300 hover:bg-cream-50 disabled:text-ink-400 disabled:border-cream-200",
  ghost: "bg-transparent text-brown-700 hover:bg-cream-100 disabled:text-ink-400",
  danger: "bg-danger text-white hover:brightness-95 disabled:bg-cream-200 disabled:text-ink-400",
};

/** แยกออกมาเพื่อให้ ButtonLink ใช้สไตล์ชุดเดียวกันได้ ไม่ต้องทำ asChild/Slot */
export function buttonClass(variant: Variant = "primary", full?: boolean, className?: string) {
  return cn(
    "inline-flex h-11 items-center justify-center gap-2 rounded-md px-5 text-base font-medium",
    "transition-colors disabled:cursor-not-allowed",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brown-500",
    VARIANTS[variant],
    full && "w-full",
    className,
  );
}

export function Button({
  variant = "primary",
  full,
  loading,
  className,
  children,
  disabled,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  full?: boolean;
  loading?: boolean;
}) {
  return (
    <button
      {...props}
      disabled={disabled ?? loading}
      className={buttonClass(variant, full, className)}
    >
      {loading && (
        <span
          aria-hidden
          className="size-4 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
}

export function ButtonLink({
  variant = "primary",
  full,
  className,
  ...props
}: React.ComponentProps<typeof Link> & { variant?: Variant; full?: boolean }) {
  return <Link {...props} className={buttonClass(variant, full, className)} />;
}
