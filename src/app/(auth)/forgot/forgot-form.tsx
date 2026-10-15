"use client";

import { useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { authClient } from "@/lib/auth-client";

/**
 * ขอลิงก์ตั้งรหัสผ่านใหม่
 *
 * **ตอบข้อความเดียวกันเสมอ** ไม่ว่าอีเมลนั้นจะมีบัญชีหรือไม่ และไม่ว่าการส่ง
 * จะสำเร็จหรือไม่ — ถ้าคำตอบต่างกัน หน้านี้จะกลายเป็นเครื่องมือไล่เดาว่าใคร
 * เป็นสมาชิก ซึ่งในแอปที่เก็บข้อมูลการตั้งครรภ์ แค่รู้ว่า "คนนี้มีบัญชี"
 * ก็เป็นข้อมูลที่เจ้าตัวอาจยังไม่อยากให้ใครรู้
 */
export function ForgotForm() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  const submit = async () => {
    if (!email.trim()) return;
    setBusy(true);
    // ไม่สนใจผลลัพธ์โดยตั้งใจ — ดูคอมเมนต์ข้างบน
    await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setBusy(false);
    setSent(true);
  };

  if (sent) {
    return (
      <div className="flex flex-col gap-2 rounded-md bg-cream-100 px-4 py-4">
        <span className="flex items-center gap-2 font-medium text-ink-900">
          <MailCheck size={18} strokeWidth={1.9} className="text-sage-700" />
          ถ้ามีบัญชีของอีเมลนี้ เราส่งลิงก์ไปแล้ว
        </span>
        <span className="text-[13px] leading-relaxed text-ink-600">
          ลิงก์ใช้ได้ครั้งเดียวภายใน 1 ชั่วโมง · ถ้าไม่เจอในกล่องจดหมาย
          ลองดูในอีเมลขยะด้วย
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-900">อีเมล</span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          aria-label="อีเมล"
          className="h-12 w-full rounded-md border border-cream-200 bg-white px-3.5 text-base text-ink-900 placeholder:text-ink-400"
          placeholder="name@example.com"
        />
      </label>

      <button
        type="button"
        disabled={busy || !email.trim()}
        onClick={submit}
        className="flex h-12 items-center justify-center gap-2 rounded-md bg-brown-700 text-sm font-semibold text-white disabled:opacity-40"
      >
        {busy && <Loader2 size={17} strokeWidth={1.9} className="animate-spin" />}
        ส่งลิงก์ให้ฉัน
      </button>
    </div>
  );
}
