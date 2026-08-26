import Link from "next/link";
import { Logo } from "@/components/logo";
import { GoogleButton } from "@/components/auth/google-button";
import { OrDivider } from "@/components/auth/divider";
import { SignupForm } from "./signup-form";

export const metadata = { title: "สมัครสมาชิก · Health Care" };

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo size={44} />
        <h1 className="text-2xl font-semibold text-ink-900">สมัครสมาชิก</h1>
        <p className="text-[13px] text-ink-400">Health Care</p>
      </div>

      <GoogleButton label="สมัครด้วย Google" next={next} />
      <OrDivider />
      <SignupForm next={next} />

      <p className="text-center text-sm text-ink-600">
        มีบัญชีอยู่แล้ว?{" "}
        <Link href="/login" className="font-medium text-brown-700 hover:text-brown-900">
          เข้าสู่ระบบ
        </Link>
      </p>
    </div>
  );
}
