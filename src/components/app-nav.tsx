"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
          <Link key={href} href={href} className="flex flex-col items-center gap-[3px]"
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
      <div className="mb-6 px-2 py-3 text-lg font-semibold text-brown-900">Pre Care</div>
      <ul className="flex flex-col gap-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = isActive(pathname, href);
          return (
            <li key={href}>
              <Link href={href}
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
