import Link from "next/link";
import { Bell, User } from "lucide-react";
import { cn } from "@/lib/cn";

/** avatar วงกลม — ถ้ายังไม่มีรูปใช้ตัวอักษรแรกของชื่อ */
export function Avatar({
  name,
  image,
  size = 32,
}: {
  name: string;
  image?: string | null;
  size?: number;
}) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- รูปจาก R2/Google, next/image ตั้ง unoptimized อยู่แล้วจึงไม่ได้ประโยชน์
      <img
        src={image}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full bg-brown-300 font-semibold text-white"
      style={{ width: size, height: size, fontSize: size * 0.42 }}
    >
      {name.trim().charAt(0) || <User size={size * 0.5} />}
    </span>
  );
}

/**
 * Top bar ของ Dashboard — โชว์ชื่อฟีเจอร์ Pre Care พร้อมจุดสี peach
 * เพื่อบอกว่ากำลังอยู่ฟีเจอร์ไหนของ Health Care
 */
export function DashboardTopBar({
  userName,
  userImage,
  familyName,
  hasSoonAppointment,
}: {
  userName: string;
  userImage?: string | null;
  familyName: string;
  hasSoonAppointment?: boolean;
}) {
  return (
    <header className="flex h-14 items-center justify-between gap-3 border-b border-cream-200 bg-white px-4 md:rounded-md md:border">
      <Link href="/profile" aria-label="โปรไฟล์">
        <Avatar name={userName} image={userImage} />
      </Link>

      <div className="flex min-w-0 flex-col items-center">
        <span className="flex items-center gap-1.5 text-[15px] font-semibold text-brown-900">
          <span aria-hidden className="size-[7px] rounded-full bg-peach-500" />
          Pre Care
        </span>
        <span className="truncate text-xs text-ink-400">{familyName}</span>
      </div>

      <Link href="/appointments" aria-label="นัดหมาย" className="relative flex">
        <Bell size={22} strokeWidth={1.8} className="text-ink-600" />
        {hasSoonAppointment && (
          <span
            aria-hidden
            className={cn("absolute -right-0.5 -top-0.5 size-2 rounded-full bg-warning ring-2 ring-white")}
          />
        )}
      </Link>
    </header>
  );
}
