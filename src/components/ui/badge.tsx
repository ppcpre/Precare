import { cn } from "@/lib/cn";
import type { Role } from "@/types";

/** Role badge — สี + label ไทยตาม design-system.md §4 */
const ROLE_STYLE: Record<Role, string> = {
  owner: "bg-brown-100 text-brown-900",
  editor: "bg-cream-200 text-ink-900",
  viewer: "bg-cream-100 text-ink-600",
};
const ROLE_LABEL: Record<Role, string> = {
  owner: "เจ้าของ",
  editor: "แก้ไขได้",
  viewer: "ดูอย่างเดียว",
};

const BASE = "inline-block rounded-full px-3 py-1 text-xs font-medium whitespace-nowrap";

export function RoleBadge({ role }: { role: Role }) {
  return <span className={cn(BASE, ROLE_STYLE[role])}>{ROLE_LABEL[role]}</span>;
}

/**
 * Badge บอกเวลาที่เหลือ 4 ระดับ — เกณฑ์ตาม screen-blueprint §6.4
 *
 * รับ `days` ที่คำนวณมาแล้ว ไม่เรียก Date.now() เองใน render
 * เพราะ React Compiler ถือว่า component ต้อง pure (eslint react-hooks/purity)
 * ให้ฝั่ง server component คำนวณด้วย daysFromNow() แล้วส่งเข้ามา
 */
export function daysFromNow(iso: string, now: number) {
  return Math.ceil((new Date(iso).getTime() - now) / 86400_000);
}

export function TimeBadge({ days }: { days: number }) {
  if (days < 0) return <span className={cn(BASE, "bg-cream-100 text-ink-400")}>ผ่านมาแล้ว</span>;
  if (days <= 1) return <span className={cn(BASE, "bg-brown-700 text-white")}>วันนี้</span>;
  if (days <= 3) return <span className={cn(BASE, "bg-warning text-ink-900")}>อีก {days} วัน</span>;
  if (days <= 30) return <span className={cn(BASE, "bg-cream-200 text-ink-600")}>อีก {days} วัน</span>;
  return (
    <span className={cn(BASE, "bg-cream-200 text-ink-600")}>อีก {Math.round(days / 30)} เดือน</span>
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return <span {...props} className={cn(BASE, "bg-cream-200 text-ink-600", className)} />;
}
