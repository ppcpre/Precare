import { FileQuestion } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

export const metadata = { title: "ไม่พบหน้านี้ · Health Care" };

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-5 bg-cream-50 px-6 text-center">
      <span className="flex size-24 items-center justify-center rounded-full bg-cream-100">
        <FileQuestion size={44} strokeWidth={1.6} className="text-brown-300" />
      </span>
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">ไม่พบหน้านี้</h1>
        <p className="max-w-xs text-sm leading-relaxed text-ink-600">
          หน้าที่คุณเปิดอาจถูกลบไปแล้ว หรือลิงก์ไม่ถูกต้อง
        </p>
      </div>
      <ButtonLink href="/">กลับหน้าแรก</ButtonLink>
    </div>
  );
}
