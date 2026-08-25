import { Home, HeartPulse, CalendarDays, Image, User } from "lucide-react";

/** bottom nav 5 แท็บ — ครอบครัวไม่อยู่ในนี้แล้ว ย้ายไปเป็นแถวในโปรไฟล์ */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "หน้าแรก", icon: Home },
  { href: "/health", label: "สุขภาพ", icon: HeartPulse },
  { href: "/appointments", label: "นัดหมาย", icon: CalendarDays },
  { href: "/album", label: "อัลบั้ม", icon: Image },
  { href: "/profile", label: "โปรไฟล์", icon: User },
] as const;
