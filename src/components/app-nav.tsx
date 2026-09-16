"use client";
/**
 * prefetch={false} บนลิงก์เมนูทุกอัน
 *
 * ค่าตั้งต้นของ Next คือ prefetch ลิงก์ที่อยู่ในจอ ซึ่งแปลว่าทุกครั้งที่เปิดหน้า
 * เมนูจะยิง render เต็มๆ ของอีก 5 หน้าเข้า worker — วัดจริงได้ 13-15 คำขอ
 * ต่อการเปิดหนึ่งหน้า ทั้งที่ผู้ใช้กดจริงแค่อันเดียว
 *
 * บนแพลนฟรีที่ CPU จำกัด 10 ms ต่อคำขอ ทุกคำขอคือโอกาสเจอ Error 1102
 * การ prefetch จึงเพิ่มโอกาสเจอหน้า error ราวสิบเท่าเพื่อแลกกับความไวตอนกดเมนู
 * และเมนูล่างกับเมนูเดสก์ท็อปเรนเดอร์พร้อมกันทั้งคู่ (ซ่อนอีกอันด้วย CSS)
 * ลิงก์ชุดเดียวกันจึงถูก prefetch ซ้ำสองรอบ
 *
 * ลิงก์ในเนื้อหา (การ์ดนัด รูปในอัลบั้ม) ยังคง prefetch ไว้เหมือนเดิม
 * เพราะมีจำนวนน้อยกว่าและมีโอกาสถูกกดจริงสูงกว่ามาก
 */

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/logo";
import { NAV_ITEMS } from "./nav-items";

function isActive(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

/** มือถือ (< md): แถบล่างตรึงจอ */
export function BottomNav() {
  const pathname = usePathname();
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 flex h-16 items-center justify-around
                 border-t border-cream-200 bg-white pb-[env(safe-area-inset-bottom)] md:hidden"
      aria-label="เมนูหลัก"
    >
      {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
        const active = isActive(pathname, href);
        return (
          <Link key={href} href={href} prefetch={false} className="flex flex-col items-center gap-[3px]"
                aria-current={active ? "page" : undefined}>
            <span className={`flex items-center rounded-full px-3.5 py-1 ${active ? "bg-brown-100" : ""}`}>
              <Icon size={21} strokeWidth={1.8} className={active ? "text-brown-700" : "text-ink-400"} />
            </span>
            <span className={`text-[11px] ${active ? "font-medium text-brown-700" : "text-ink-400"}`}>
              {label}
            </span>
          </Link>
        );
      })}
    </nav>
  );
}

/** จอกว้าง (>= md): sidebar ซ้าย */
export function Sidebar() {
  const pathname = usePathname();
  return (
    <aside className="hidden w-60 shrink-0 border-r border-cream-200 bg-cream-100 p-4 md:block"
           aria-label="เมนูหลัก">
      <Link href="/dashboard" prefetch={false} className="mb-6 flex items-center gap-2.5 px-2 py-3">
        <Logo size={34} className="shrink-0" />
        <span className="text-lg font-semibold text-brown-900">Pre Care</span>
      </Link>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href} prefetch={false}
                    aria-current={active ? "page" : undefined}
                    className={`flex items-center gap-3 rounded-md px-3 py-2.5 text-sm
                      ${active ? "bg-brown-100 font-medium text-brown-900" : "text-ink-600 hover:bg-cream-200"}`}>
                <Icon size={20} strokeWidth={1.8} className={active ? "text-brown-700" : "text-ink-600"} />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </aside>
  );
}
