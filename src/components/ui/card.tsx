import { cn } from "@/lib/cn";

/** white / border cream-200 / radius-md / padding space-4 / shadow-card */
export function Card({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn(
        "rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]",
        className,
      )}
    />
  );
}

export function CardTitle({ className, ...props }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h2 {...props} className={cn("text-xl font-semibold text-ink-900", className)} />;
}
