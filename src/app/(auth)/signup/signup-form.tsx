"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { signUp } from "@/lib/auth-client";
import { cn } from "@/lib/cn";

/** วัดความแข็งแรงคร่าวๆ 3 ระดับ ตาม password strength meter ที่ออกแบบไว้ */
function strengthOf(pw: string) {
  let score = 0;
  if (pw.length >= 8) score++;
  if (pw.length >= 12) score++;
  if (/[^a-zA-Z]/.test(pw) && /[a-zA-Z]/.test(pw)) score++;
  return Math.min(3, score);
}

const BARS = ["bg-danger", "bg-warning", "bg-success"];
const LABELS = ["สั้นเกินไป", "พอใช้ — เพิ่มตัวเลขหรืออักขระพิเศษ", "ดี"];

export function SignupForm({ next }: { next?: string }) {
  const router = useRouter();
  const [pw, setPw] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const level = strengthOf(pw);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setEmailError(null);
        setLoading(true);
        const res = await signUp.email({
          name: String(fd.get("name")).trim(),
          email: String(fd.get("email")).trim().toLowerCase(),
          password: String(fd.get("password")),
        });
        if (res.error) {
          if (res.error.code === "USER_ALREADY_EXISTS") setEmailError("อีเมลนี้มีบัญชีอยู่แล้ว");
          else setError(res.error.message ?? "สมัครสมาชิกไม่สำเร็จ");
          setLoading(false);
          return;
        }
        // ยังไม่มี family -> root จะพาไป /onboarding เอง
        router.push(next ?? "/");
        router.refresh();
      }}
    >
      {error && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          {error}
        </p>
      )}

      <Field label="ชื่อ-นามสกุล" name="name" autoComplete="name" required maxLength={80} />
      <Field
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="you@example.com"
        required
        error={emailError ?? undefined}
        hint={emailError ? undefined : "ใช้อีเมลเป็นชื่อผู้ใช้"}
      />

      <div className="flex flex-col gap-2">
        <PasswordField
          name="password"
          autoComplete="new-password"
          hint="อย่างน้อย 8 ตัวอักษร"
          onValueChange={setPw}
        />
        {pw.length > 0 && (
          <>
            <div className="flex gap-1.5">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={cn("h-1 flex-1 rounded-full", i < level ? BARS[level - 1] : "bg-cream-200")}
                />
              ))}
            </div>
            <p className="text-xs text-ink-400">{LABELS[Math.max(0, level - 1)]}</p>
          </>
        )}
      </div>

      <label className="flex items-start gap-2.5 text-sm text-ink-600">
        <input
          type="checkbox"
          checked={accepted}
          onChange={(e) => setAccepted(e.target.checked)}
          className="mt-0.5 size-5 min-h-0 shrink-0 accent-brown-700"
        />
        <span className="leading-relaxed">
          ยอมรับ<Link href="/terms" className="text-brown-700">เงื่อนไขการใช้งาน</Link> และ
          <Link href="/privacy" className="text-brown-700">นโยบายความเป็นส่วนตัว</Link>
        </span>
      </label>

      <Button type="submit" full loading={loading} disabled={!accepted}>
        สมัครสมาชิก
      </Button>
    </form>
  );
}
