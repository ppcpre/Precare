import { cn } from "@/lib/cn";

/** อายุครรภ์ 1–40 สัปดาห์ · track cream-200 · fill brown-500 · radius-full */
export function GestationProgress({ week, className }: { week: number; className?: string }) {
  const pct = Math.min(100, Math.max(0, (week / 40) * 100));
  const over = week > 40;
  return (
    <div
      role="progressbar"
      aria-valuenow={week}
      aria-valuemin={1}
      aria-valuemax={40}
      aria-label={`อายุครรภ์สัปดาห์ที่ ${week} จาก 40`}
      className={cn("h-2 w-full overflow-hidden rounded-full bg-cream-200", className)}
    >
      <div
        className={cn("h-full rounded-full", over ? "bg-brown-700" : "bg-brown-500")}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
