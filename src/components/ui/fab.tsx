import Link from "next/link";
import { Plus } from "lucide-react";

/**
 * ปุ่มลอยมุมขวาล่างของมือถือ — ต้องลอยเหนือแถบเมนู ไม่ใช่อยู่ใต้มัน
 *
 * เดิมเขียน `bottom-20` (80px) ไว้ซ้ำกันสามหน้า แต่แถบเมนูสูง
 * `4rem + env(safe-area-inset-bottom)` ซึ่งบนเครื่องที่มีแถบลากล่าง (iPhone
 * ที่ไม่มีปุ่มโฮม) คือ 64 + ~34 = ~98px **ปุ่มบวกจึงจมอยู่ใต้แถบเมนู**
 *
 * เทสต์จับไม่ได้เพราะ headless browser ให้ env(safe-area-inset-bottom) = 0
 * แถบเมนูจึงสูงแค่ 64px และปุ่มที่ 80px ยังพ้นพอดี — เห็นเฉพาะบนเครื่องจริง
 * (e2e จึงต้องตั้ง --safe-b เองเพื่อจำลอง ดู e2e/mobile-audit.spec.ts)
 *
 * รวมเป็น component เดียวเพื่อให้ตำแหน่งนี้มีที่อยู่ที่เดียว ไม่ต้องแก้สามที่
 */
export function Fab({ href, label }: { href: string; label: string }) {
  return (
    <Link
      prefetch={false}
      href={href}
      aria-label={label}
      className="fixed right-4 bottom-[calc(4rem+var(--safe-b)+1rem)] flex size-14 items-center justify-center rounded-full bg-brown-700 text-white shadow-[0_4px_12px_rgba(43,36,32,0.18)] md:hidden"
    >
      <Plus size={26} strokeWidth={2} />
    </Link>
  );
}
