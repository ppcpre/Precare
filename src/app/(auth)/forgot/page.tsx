import Link from "next/link";
import { ForgotForm } from "./forgot-form";

export const metadata = { title: "ลืมรหัสผ่าน · Pre Care" };

export default function ForgotPage() {
  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-ink-900">ลืมรหัสผ่าน</h1>
        <p className="text-sm leading-relaxed text-ink-600">
          กรอกอีเมลที่ใช้สมัคร เราจะส่งลิงก์ตั้งรหัสผ่านใหม่ไปให้
        </p>
      </header>

      <ForgotForm />

      <p className="text-center text-sm text-ink-600">
        <Link href="/login" className="font-medium text-brown-700 hover:text-brown-900">
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}
