"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { authClient } from "@/lib/auth-client";
import { MIN_PASSWORD, checkNewPassword } from "@/lib/password";

/**
 * เปลี่ยนรหัสผ่านของตัวเอง
 *
 * เรียก better-auth ตรงจากฝั่ง client เหมือน signin/signup/signout
 * ไม่ผ่าน server action — เพื่อให้ rate limit และการจัดการ session
 * ของ better-auth ทำงานเป็นชุดเดียวกัน ไม่ต้องมีทางเข้าที่สองให้ดูแล
 */
export function PasswordForm({ email }: { email: string }) {
  const router = useRouter();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const submit = async () => {
    const check = checkNewPassword(next, confirm, email);
    if (!check.ok) return setError(check.message);
    if (next === current) return setError("รหัสผ่านใหม่ซ้ำกับรหัสเดิม");

    setError(null);
    setBusy(true);
    const res = await authClient.changePassword({
      currentPassword: current,
      newPassword: next,
      /**
       * ออกจากระบบในเครื่องอื่นเสมอ ไม่ให้เลือก
       *
       * คนเปลี่ยนรหัสผ่านเพราะกลัวมีคนอื่นเข้าถึงบัญชีได้ ถ้าเครื่องที่เขา
       * กลัวยังล็อกอินค้างอยู่ การเปลี่ยนรหัสก็แทบไม่มีความหมาย
       * ยิ่ง session ของเราอยู่ได้ 60 วัน
       */
      revokeOtherSessions: true,
    });
    setBusy(false);

    if (res.error) {
      // ข้อความจาก better-auth เป็นอังกฤษ — แปลเฉพาะเคสที่เจอจริง
      setError(
        res.error.status === 400
          ? "รหัสผ่านปัจจุบันไม่ถูกต้อง"
          : (res.error.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ ลองใหม่อีกครั้ง"),
      );
      return;
    }

    setCurrent("");
    setNext("");
    setConfirm("");
    setDone(true);
    router.refresh();
  };

  const field = (
    label: string,
    value: string,
    set: (v: string) => void,
    autoComplete: string,
    hint?: string,
  ) => (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] text-ink-600">{label}</span>
      <input
        type={show ? "text" : "password"}
        value={value}
        autoComplete={autoComplete}
        onChange={(e) => set(e.target.value)}
        placeholder={hint}
        aria-label={label}
        className="h-11 w-full rounded-sm border border-cream-200 bg-white px-3 text-base text-ink-900 placeholder:text-ink-400"
      />
    </label>
  );

  if (done) {
    return (
      <div className="flex flex-col gap-3">
        <p className="rounded-sm bg-sage-100 px-3 py-2.5 text-[13px] leading-relaxed text-ink-900">
          เปลี่ยนรหัสผ่านเรียบร้อยแล้ว · เครื่องอื่นที่เคยเข้าไว้ถูกออกจากระบบทั้งหมด
          เครื่องนี้ยังใช้งานต่อได้
        </p>
        <button
          type="button"
          onClick={() => router.push("/profile")}
          className="flex h-11 items-center justify-center rounded-md bg-brown-700 text-sm font-semibold text-white"
        >
          กลับไปหน้าโปรไฟล์
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {field("รหัสผ่านปัจจุบัน", current, setCurrent, "current-password")}
      {field("รหัสผ่านใหม่", next, setNext, "new-password", `อย่างน้อย ${MIN_PASSWORD} ตัว`)}
      {field("ยืนยันรหัสผ่านใหม่", confirm, setConfirm, "new-password", "พิมพ์ซ้ำอีกครั้ง")}

      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        className="flex min-h-11 items-center gap-1.5 self-start rounded-md px-1 text-[13px] text-ink-600"
      >
        {show ? <EyeOff size={16} strokeWidth={1.9} /> : <Eye size={16} strokeWidth={1.9} />}
        {show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
      </button>

      <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[11px] leading-relaxed text-ink-600">
        เปลี่ยนแล้วเครื่องอื่นที่เคยเข้าไว้จะถูกออกจากระบบทั้งหมด ต้องเข้าใหม่ด้วยรหัสใหม่
        · เครื่องนี้ใช้งานต่อได้เลย
      </p>

      {error && <p className="text-xs text-danger">{error}</p>}

      <button
        type="button"
        disabled={busy || !current || !next || !confirm}
        onClick={submit}
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-brown-700 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy && <Loader2 size={17} strokeWidth={1.9} className="animate-spin" />}
        บันทึกรหัสผ่านใหม่
      </button>
    </div>
  );
}
