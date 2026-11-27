import Link from "next/link";
import { ResetForm } from "./reset-form";

export const metadata = { title: "ตั้งรหัสผ่านใหม่ · Pre Care" };

/**
 * better-auth พาผู้ใช้มาที่นี่หลังตรวจลิงก์ในอีเมลแล้ว
 * - ลิงก์ใช้ได้ → `?token=...`
 * - ลิงก์หมดอายุหรือถูกใช้ไปแล้ว → `?error=...`
 */
export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string; error?: string }>;
}) {
  const { token, error } = await searchParams;

  if (!token || error) {
    return (
      <div className="flex flex-col gap-5">
        <header className="flex flex-col gap-1.5">
          <h1 className="text-2xl font-semibold text-ink-900">ลิงก์ใช้ไม่ได้แล้ว</h1>
          <p className="text-sm leading-relaxed text-ink-600">
            ลิงก์ตั้งรหัสผ่านใช้ได้ครั้งเดียวและหมดอายุใน 1 ชั่วโมง ขอลิงก์ใหม่ได้เลย
          </p>
        </header>
        <Link
          href="/forgot"
          className="flex h-12 items-center justify-center rounded-md bg-brown-700 text-sm font-semibold text-white"
        >
          ขอลิงก์ใหม่
        </Link>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1.5">
        <h1 className="text-2xl font-semibold text-ink-900">ตั้งรหัสผ่านใหม่</h1>
        <p className="text-sm leading-relaxed text-ink-600">
          ตั้งเสร็จแล้วเครื่องที่เคยเข้าไว้ทั้งหมดจะถูกออกจากระบบ
        </p>
      </header>
      <ResetForm token={token} />
    </div>
  );
}
