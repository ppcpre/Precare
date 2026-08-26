import { ListSkeleton, Skeleton } from "@/components/ui/skeleton";

/** ใช้ร่วมทุกหน้าในโซนแอป — ทรงกลางๆ ที่ไม่กระโดดมากตอนของจริงมาแทน */
export default function Loading() {
  return (
    <div className="flex flex-col gap-4">
      <Skeleton className="h-8 w-40" />
      <ListSkeleton count={3} />
    </div>
  );
}
