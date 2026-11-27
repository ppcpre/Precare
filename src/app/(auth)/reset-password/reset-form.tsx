"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD, checkNewPassword } from "@/lib/password";

/**
 * ตั้งรหัสผ่านใหม่จากลิงก์ในอีเมล
 *
 * ใช้กฎเดียวกับหน้าเปลี่ยนรหัสผ่าน (src/lib/password.ts) — คนที่มาทางนี้คือคน
 * ที่เข้าบัญชีไม่ได้ ถ้าปล่อยให้ตั้งรหัสง่ายๆ ได้ ก็เท่ากับเปิดประตูทิ้งไว้
 *
 * ไม่รู้อีเมลของเจ้าของ token (ตั้งใจ — หน้านี้เปิดได้โดยไม่ต้องล็อกอิน)
 * กฎข้อ "ห้ามมีชื่ออีเมลอยู่ในรหัส" จึงข้ามไปโดยส่งอีเมลว่าง
 */
export function ResetForm({ token }: { token: string }) {
  const router = useRouter();
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const check = checkNewPassword(next, confirm, "");
    if (!check.ok) return setError(check.message);

    setError(null);
    setBusy(true);
    const res = await authClient.resetPassword({ newPassword: next, token });
    setBusy(false);

    if (res.error) {
      setError(
        res.error.status === 400
          ? "ลิงก์นี้ใช้ไม่ได้แล้ว ขอลิงก์ใหม่อีกครั้ง"
          : (res.error.message ?? "ตั้งรหัสผ่านใหม่ไม่สำเร็จ"),
      );
      return;
    }
    // รีเซ็ตแล้ว session ทุกเครื่องถูกถอน — ต้องเข้าสู่ระบบใหม่ด้วยรหัสใหม่
    router.push("/login?reset=1");
  };

  const field = (label: string, value: string, set: (v: string) => void, hint: string) => (
    <label className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-900">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        autoComplete="new-password"
        onChange={(e) => set(e.target.value)}
        placeholder={hint}
        aria-label={label}
        className="h-12 w-full rounded-md border border-cream-200 bg-white px-3.5 text-base text-ink-900 placeholder:text-ink-400"
      />
    </label>
  );

  return (
    <div className="flex flex-col gap-3">
      {field("รหัสผ่านใหม่", next, setNext, `อย่างน้อย ${MIN_PASSWORD} ตัว`)}
      {field("ยืนยันรหัสผ่านใหม่", confirm, setConfirm, "พิมพ์ซ้ำอีกครั้ง")}

      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-md px-1 text-[13px] text-ink-600"
      >
        {show ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
        {show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      </button>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        disabled={busy || !next || !confirm}
        onClick={submit}
        className="flex h-12 items-center justify-center gap-2 rounded-md bg-brown-700 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy && <Loader2 size={17} strokeWidth={1.9} className="animate-spin" />}
        ตั้งรหัสผ่านใหม่แล้วเข้าสู่ระบบ
      </button>
    </div>
  );
}
