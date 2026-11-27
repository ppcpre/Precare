"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { signIn } from "@/lib/auth-client";

export function LoginForm({ next }: { next?: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={async (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setLoading(true);
        const res = await signIn.email({
          email: String(fd.get("email")).trim().toLowerCase(),
          password: String(fd.get("password")),
        });
        if (res.error) {
          // ไม่บอกว่าอีเมลผิดหรือรหัสผิด — กัน account enumeration
          setError(
            res.error.status === 429
              ? "ลองใหม่ถี่เกินไป กรุณารอสักครู่"
              : "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
          );
          setLoading(false);
          return;
        }
        router.push(next ?? "/");
        router.refresh();
      }}
    >
      {error && (
        <p
          role="alert"
          className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm text-ink-900"
        >
          {error}
        </p>
      )}

      <Field
        label="อีเมล"
        name="email"
        type="email"
        autoComplete="username"
        placeholder="you@example.com"
        required
      />
      <PasswordField name="password" autoComplete="current-password" />

      <Button type="submit" full loading={loading}>
        เข้าสู่ระบบ
      </Button>
    </form>
  );
}
