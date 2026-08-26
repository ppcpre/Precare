import { cn } from "@/lib/cn";

/** shimmer โทน cream ทรงเดียวกับการ์ดจริง — ไม่ใช้ spinner กลางจอ */
export function Skeleton({ className }: { className?: string }) {
  return <span className={cn("block animate-pulse rounded-sm bg-cream-200", className)} />;
}

export function CardSkeleton({ lines = 2 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4">
      <Skeleton className="h-5 w-32" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={i === lines - 1 ? "h-4 w-2/3" : "h-4 w-full"} />
      ))}
    </div>
  );
}

export function ListSkeleton({ count = 3 }: { count?: number }) {
  return (
    <div className="flex flex-col gap-3">
      <Skeleton className="h-4 w-24" />
      {Array.from({ length: count }, (_, i) => (
        <CardSkeleton key={i} />
      ))}
    </div>
  );
}
