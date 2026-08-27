import Link from "next/link";
import { Bell } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { Logo } from "@/components/logo";

// ย้าย Avatar ไปเป็น client component (ต้องใช้ onError) แต่ re-export ไว้ที่เดิม
// เพราะมีหน้าอื่นอีกหลายที่ import จากไฟล์นี้อยู่
export { Avatar };

/**
 * Header ร่วมของทุกหน้าในแอป
 * ซ้าย: ชื่อฟีเจอร์ Pre Care + ชื่อครอบครัว · ขวา: กระดิ่ง + avatar โปรไฟล์
 *
 * avatar อยู่มุมขวาบนทุกหน้า เพื่อให้รู้ตลอดว่ากำลังใช้งานด้วยบัญชีไหน
 * และกดเข้าโปรไฟล์ได้จากทุกที่ ไม่ต้องกลับไปที่ bottom nav
 */
export function AppHeader({
  userName,
  userImage,
  familyName,
  hasSoonAppointment,
}: {
  userName: string;
  userImage?: string | null;
  familyName?: string | null;
  hasSoonAppointment?: boolean;
}) {
  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-cream-200 bg-white px-4">
      <Link href="/dashboard" className="flex min-w-0 items-center gap-2">
        <Logo size={30} className="shrink-0" />
        <span className="flex min-w-0 flex-col">
          <span className="text-[15px] font-semibold leading-tight text-brown-900">Pre Care</span>
          {familyName && <span className="truncate text-xs text-ink-400">{familyName}</span>}
        </span>
      </Link>

      <div className="flex shrink-0 items-center gap-1">
        <Link
          href="/appointments"
          aria-label="นัดหมาย"
          className="relative flex size-10 items-center justify-center rounded-full hover:bg-cream-100"
        >
          <Bell size={21} strokeWidth={1.8} className="text-ink-600" />
          {hasSoonAppointment && (
            <span
              aria-hidden
              className="absolute right-2 top-2 size-2 rounded-full bg-warning ring-2 ring-white"
            />
          )}
        </Link>

        {/* โปรไฟล์มุมขวาบน — เห็นได้ทุกหน้า */}
        <Link
          href="/profile"
          aria-label={`โปรไฟล์ของ ${userName}`}
          className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 hover:bg-cream-100 md:pr-3"
        >
          <Avatar name={userName} image={userImage} size={32} />
          <span className="hidden max-w-[9rem] truncate text-sm text-ink-900 md:block">
            {userName}
          </span>
        </Link>
      </div>
    </header>
  );
}
