import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { POLICY_VERSION } from "@/lib/consent";

/**
 * หน้านโยบาย — เปิดได้โดยไม่ต้องล็อกอิน
 *
 * ต้องอยู่นอกกลุ่ม (app) เพราะคนอ่านหน้านี้คือคนที่**ยังไม่ได้สมัคร**
 * และกำลังตัดสินใจว่าจะสมัครดีไหม ถ้าบังคับล็อกอินก่อนอ่าน
 * ก็เท่ากับให้ยินยอมก่อนแล้วค่อยอ่านว่ายินยอมกับอะไร
 */
export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-dvh bg-cream-50">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-1 border-b border-cream-200 bg-white px-2">
        <Link
          href="/signup"
          aria-label="กลับ"
          className="flex size-11 items-center justify-center rounded-sm text-ink-600"
        >
          <ChevronLeft size={22} strokeWidth={1.9} />
        </Link>
        <span className="font-semibold text-ink-900">Pre Care</span>
      </header>

      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-5 p-4 pb-16">
        {children}

        <footer className="flex flex-col gap-1 border-t border-cream-200 pt-4 text-xs text-ink-400">
          <span>เวอร์ชัน {POLICY_VERSION}</span>
          <span className="leading-relaxed">
            เอกสารนี้เขียนขึ้นเพื่ออธิบายการทำงานจริงของแอปด้วยภาษาที่อ่านเข้าใจได้
            ยังไม่ได้ผ่านการตรวจโดยผู้เชี่ยวชาญด้านกฎหมาย
            และต้องได้รับการตรวจก่อนเปิดให้บุคคลทั่วไปใช้งาน
          </span>
        </footer>
      </main>
    </div>
  );
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-[15px] font-semibold text-ink-900">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-ink-600">{children}</div>
    </section>
  );
}
