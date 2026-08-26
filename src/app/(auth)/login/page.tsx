import Link from "next/link";
import { Logo } from "@/components/logo";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/divider";
import { LoginForm } from "./login-form";

export const metadata = { title: "เข้าสู่ระบบ · Health Care" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-col gap-7">
      <div className="flex flex-col items-center gap-2.5 text-center">
        <Logo size={52} />
        <h1 className="text-[28px] font-semibold text-ink-900">Health Care</h1>
        <p className="text-sm text-ink-600">ดูแลสุขภาพของทั้งครอบครัว ไว้ในที่เดียว</p>
      </div>

      <GoogleButton label="เข้าสู่ระบบด้วย Google" next={next} />
      <OrDivider />
      <LoginForm next={next} />

      {/*
        Phase 1 ยังไม่มี email service จึงรีเซ็ตรหัสผ่านไม่ได้
        เขียนให้เป็น "ทางออก" ไม่ใช่คำขอโทษ — account linking ทำให้กด Google แล้วเข้าบัญชีเดิมได้
      */}
      <p className="rounded-sm bg-cream-100 px-3.5 py-3 text-xs leading-relaxed text-ink-600">
        ลืมรหัสผ่าน? ตอนนี้ยังรีเซ็ตเองไม่ได้ — ถ้าอีเมลของคุณเป็น Gmail ให้กด
        <span className="font-medium text-brown-700"> เข้าสู่ระบบด้วย Google </span>
        ด้านบนได้เลย ระบบจะพาเข้าบัญชีเดิมให้อัตโนมัติ
      </p>

      <p className="text-center text-sm text-ink-600">
        ยังไม่มีบัญชี?{" "}
        <Link href="/signup" className="font-medium text-brown-700 hover:text-brown-900">
          สมัครสมาชิก
        </Link>
      </p>
    </div>
  );
}
