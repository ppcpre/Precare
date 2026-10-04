import { Home, HeartPulse, CalendarDays, Image, Utensils } from "lucide-react";

/**
 * bottom nav 5 แท็บ
 *
 * โปรไฟล์ไม่อยู่ในนี้แล้ว — เข้าได้จากรูปตัวเองมุมขวาบนซึ่งมีอยู่ทุกหน้า
 * ที่ของมันถูกแทนด้วย "นับแคล" ซึ่งเป็นของที่บันทึกวันละหลายครั้ง
 * ต่างจากโปรไฟล์ที่เข้าไปตั้งค่าแล้วแทบไม่กลับไปอีก
 */
export const NAV_ITEMS = [
  { href: "/dashboard", label: "หน้าแรก", icon: Home },
  { href: "/health", label: "สุขภาพ", icon: HeartPulse },
  { href: "/appointments", label: "นัดหมาย", icon: CalendarDays },
  { href: "/album", label: "อัลบั้ม", icon: Image },
  { href: "/food", label: "นับแคล", icon: Utensils },
] as const;
