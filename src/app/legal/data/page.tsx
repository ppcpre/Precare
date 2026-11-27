import Link from "next/link";
import { Activity, Calendar, Image as ImageIcon, ShieldCheck, User } from "lucide-react";
import { Section } from "../layout";
import { COLLECTED } from "@/lib/consent";

export const metadata = { title: "ข้อมูลที่เราเก็บ · Pre Care" };

const ICONS = { pulse: Activity, image: ImageIcon, calendar: Calendar, user: User };

export default function DataPage() {
  return (
    <>
      <h1 className="text-2xl font-semibold text-ink-900">ข้อมูลที่เราเก็บ</h1>

      <p className="flex items-start gap-2.5 rounded-md border border-[#CFDCC9] bg-[#EEF3EC] p-3.5 text-[13px] leading-relaxed text-ink-600">
        <ShieldCheck size={20} strokeWidth={1.9} className="mt-px shrink-0 text-[#5F7358]" />
        เขียนแบบอ่านรู้เรื่อง ไม่ใช่ภาษากฎหมาย ฉบับเต็มอยู่ที่
        <Link href="/legal/privacy" className="text-brown-700">
          นโยบายความเป็นส่วนตัว
        </Link>
      </p>

      <section className="flex flex-col gap-3.5 rounded-md border border-cream-200 bg-white p-4">
        {COLLECTED.map((c) => {
          const Icon = ICONS[c.icon];
          return (
            <div key={c.title} className="flex items-start gap-2.5">
              <span className="flex size-[34px] shrink-0 items-center justify-center rounded-[9px] bg-cream-100">
                <Icon size={17} strokeWidth={1.8} className="text-ink-600" />
              </span>
              <span className="flex flex-col gap-0.5">
                <span className="text-sm font-medium text-ink-900">{c.title}</span>
                <span className="text-xs leading-relaxed text-ink-600">{c.detail}</span>
              </span>
            </div>
          );
        })}
      </section>

      <Section title="ใครเห็นบ้าง">
        <p>
          คนในครอบครัวเดียวกับคุณเห็นทั้งหมด นี่คือจุดประสงค์ของแอป
          แต่ก็แปลว่าการเชิญใครเข้ามาคือการเปิดข้อมูลเหล่านี้ให้เขา
        </p>
        <p>
          และในทางกลับกัน ถ้าคุณเป็นฝ่ายถูกเชิญ
          คนที่เชิญคุณก็จะเห็นสิ่งที่คุณบันทึกเช่นกัน
        </p>
      </Section>

      <Section title="เก็บนานแค่ไหน">
        <p>ตราบที่บัญชียังอยู่ ลบบัญชีเมื่อไหร่ ข้อมูลและไฟล์หายทันทีและถาวร</p>
      </Section>

      <Section title="ที่ไม่ได้เก็บ">
        <p>
          เราไม่เก็บตำแหน่งที่อยู่ ไม่เก็บรายชื่อผู้ติดต่อในเครื่อง
          และไม่ติดตามการใช้งานของคุณข้ามเว็บไซต์อื่น
        </p>
      </Section>
    </>
  );
}
