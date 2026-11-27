import type { BabyLogKind } from "@/db/schema";
import { cn } from "@/lib/cn";

/** เส้นไอคอนชุดเดียวกับ design/gen.py — lucide ไม่มีเต้า ผ้าอ้อม หรือที่ปั๊มนม */
const PATHS: Record<BabyLogKind, React.ReactNode> = {
  breast: (
    <>
      <path d="M3.5 7c.5 5 2.5 9 5 9s3.5-2.5 3.5-5.5c0 3 1 5.5 3.5 5.5s4.5-4 5-9" />
      <path d="M3.5 7 5 4M20.5 7 19 4" />
    </>
  ),
  bottle: (
    <>
      <path d="M9 7.5h6l.8 2.2v9.6a1.7 1.7 0 0 1-1.7 1.7H9.9a1.7 1.7 0 0 1-1.7-1.7V9.7Z" />
      <path d="M10 7.5V5.6c0-.9.9-2.1 2-2.1s2 1.2 2 2.1v1.9" />
      <path d="M8.4 12.5h2.8M8.4 15.5h2.8" />
    </>
  ),
  diaper: (
    <>
      <path d="M3.5 6.5h17v3.2a8.5 8.5 0 0 1-8.5 8.8 8.5 8.5 0 0 1-8.5-8.8Z" />
      <path d="M3.5 9.5c3 0 4.5 2 5 4.5M20.5 9.5c-3 0-4.5 2-5 4.5" />
    </>
  ),
  sleep: <path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1Z" />,
  pump: (
    <>
      <path d="M9 10h6v9.3a1.7 1.7 0 0 1-1.7 1.7h-2.6A1.7 1.7 0 0 1 9 19.3Z" />
      <path d="M9.5 10 8 6.5a2 2 0 0 1 1.8-2.8h4.4A2 2 0 0 1 16 6.5L14.5 10" />
      <path d="M16 5.5h3.5l-1 4" />
      <path d="M11 14h2M11 17h2" />
    </>
  ),
  bath: (
    <>
      <path d="M3.5 12h17v1.5a5 5 0 0 1-5 5h-7a5 5 0 0 1-5-5Z" />
      <path d="M7 18.5 6 20.5M17 18.5l1 2" />
      <circle cx="14" cy="6" r="1.6" />
      <circle cx="17.5" cy="8.5" r="1.1" />
      <circle cx="11" cy="8.6" r="1" />
    </>
  ),
};

/** สีตัวอักษร / พื้นอ่อน / พื้นเต็ม (ตอนกำลังจับเวลา) ของแต่ละประเภท */
export const KIND_TONE: Record<BabyLogKind, { fg: string; soft: string; solid: string; bar: string }> = {
  breast: { fg: "text-peach-700", soft: "bg-peach-100", solid: "bg-peach-700", bar: "bg-peach-700" },
  bottle: { fg: "text-sky-700", soft: "bg-sky-100", solid: "bg-sky-700", bar: "bg-sky-700" },
  diaper: { fg: "text-sage-700", soft: "bg-sage-100", solid: "bg-sage-700", bar: "bg-sage-700" },
  sleep: { fg: "text-plum-700", soft: "bg-plum-100", solid: "bg-plum-700", bar: "bg-plum-500" },
  pump: { fg: "text-clay-700", soft: "bg-clay-100", solid: "bg-clay-700", bar: "bg-clay-700" },
  bath: { fg: "text-honey-700", soft: "bg-honey-100", solid: "bg-honey-700", bar: "bg-honey-700" },
};

export function KindIcon({
  kind,
  size = 20,
  className,
}: {
  kind: BabyLogKind;
  size?: number;
  className?: string;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("shrink-0", className)}
    >
      {PATHS[kind]}
    </svg>
  );
}

/** วงกลมพื้นอ่อน + ไอคอน — ใช้ทั้งปุ่มกดด่วน สรุปวัน และรายการล่าสุด */
export function KindBadge({ kind, size = 40 }: { kind: BabyLogKind; size?: number }) {
  const t = KIND_TONE[kind];
  return (
    <span
      className={cn("flex shrink-0 items-center justify-center rounded-full", t.soft, t.fg)}
      style={{ width: size, height: size }}
    >
      <KindIcon kind={kind} size={Math.round(size * 0.5)} />
    </span>
  );
}
