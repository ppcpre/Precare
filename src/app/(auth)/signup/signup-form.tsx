"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { PasswordField } from "@/components/auth/password-field";
import { signUp } from "@/lib/auth-client";
import { recordConsents } from "@/actions/consent";
import { POLICY_VERSION, type ConsentKind } from "@/lib/consent";
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
  /**
   * ทุกช่องเริ่มจาก **ว่าง** ห้ามติ๊กมาให้ล่วงหน้า
   * ความยินยอมที่ติ๊กมาแล้วไม่ถือเป็นการเลือกโดยสมัครใจ
   */
  const [granted, setGranted] = useState<Set<ConsentKind>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailError, setEmailError] = useState<string | null>(null);

  const level = strengthOf(pw);
  const canSubmit = granted.has("terms") && granted.has("health_data");

  const toggle = (kind: ConsentKind, on: boolean) =>
    setGranted((cur) => {
      const next = new Set(cur);
      if (on) next.add(kind);
      else next.delete(kind);
      return next;
    });

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
        /**
         * บันทึกความยินยอมหลังสมัครสำเร็จ ตอนที่มี session แล้ว
         *
         * ก่อนหน้านี้ยังไม่มี userId ให้ผูก และความยินยอมของคนที่สมัครไม่สำเร็จ
         * ก็ไม่มีประโยชน์ที่จะเก็บ
         *
         * ถ้าบันทึกไม่สำเร็จก็ยังพาเข้าแอป — บัญชีถูกสร้างไปแล้ว การค้างไว้ที่
         * หน้าสมัครทำให้ผู้ใช้ติดอยู่กับที่โดยแก้อะไรไม่ได้
         * action นี้ทำซ้ำได้ จึงเรียกใหม่ทีหลังได้ถ้าต้องการ
         */
        await recordConsents({ granted: [...granted], version: POLICY_VERSION }).catch(() => null);

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

      {/* แยกความยินยอมเป็นข้อๆ ไม่รวมเป็นติ๊กเดียว
          ข้อมูลสุขภาพเป็นข้อมูลอ่อนไหวตามมาตรา 26 ต้องขอแยกจากเงื่อนไขทั่วไป
          ไม่ใส่หัวข้อคั่น — สามช่องนี้อยู่เหนือปุ่มสมัครอยู่แล้ว */}
      <div className="flex flex-col gap-0.5">
        <ConsentRow
          kind="terms"
          checked={granted.has("terms")}
          onChange={toggle}
          label={
            <>
              ยอมรับ<Link href="/legal/terms" className="text-brown-700">เงื่อนไข</Link>และ
              <Link href="/legal/privacy" className="text-brown-700">นโยบายความเป็นส่วนตัว</Link>
            </>
          }
        />

        {/* ข้อนี้คือหัวใจ ให้ต่างจากอีกสองข้อด้วยตา
            ไม่ใช่ทำให้เท่ากันหมดแล้วข้อสำคัญจมหายไป */}
        <ConsentRow
          kind="health_data"
          checked={granted.has("health_data")}
          onChange={toggle}
          emphasis
          label="ยินยอมให้เก็บและใช้ข้อมูลสุขภาพ"
          detail={
            <>
              คนในครอบครัวที่คุณเชิญจะเห็นข้อมูลนี้ ·{" "}
              <Link href="/legal/data" className="text-brown-700">
                ดูว่าเก็บอะไรบ้าง
              </Link>
            </>
          }
        />

        <ConsentRow
          kind="marketing"
          checked={granted.has("marketing")}
          onChange={toggle}
          label="รับอีเมลแจ้งเตือนนัดหมาย"
          optional
        />
      </div>

      <Button type="submit" full loading={loading} disabled={!canSubmit}>
        สมัครสมาชิก
      </Button>
      {!canSubmit && (
        <p className="text-center text-xs text-ink-400">
          ต้องยินยอมสองข้อแรกก่อนจึงจะสมัครได้
        </p>
      )}
    </form>
  );
}

/**
 * ช่องยินยอมหนึ่งข้อ
 *
 * พื้นที่แตะคือทั้งแถว (เป็น label) ไม่ใช่แค่กล่องสี่เหลี่ยม 20px
 * ความยินยอมที่กดยากคือความยินยอมที่คนกดผิด
 */
function ConsentRow({
  kind,
  checked,
  onChange,
  label,
  detail,
  optional = false,
  emphasis = false,
}: {
  kind: ConsentKind;
  checked: boolean;
  onChange: (kind: ConsentKind, on: boolean) => void;
  label: React.ReactNode;
  detail?: React.ReactNode;
  optional?: boolean;
  emphasis?: boolean;
}) {
  return (
    <label
      className={cn(
        "flex min-h-11 items-start gap-2.5 rounded-[10px] py-3 text-sm",
        // พื้นสีดันออกนอกระยะขอบแล้วชดเชยด้วย padding เท่ากัน
        // เพื่อให้ช่องติ๊กยังตรงแนวกับข้ออื่น พื้นสีจึงเป็นการเน้น ไม่ใช่การย่อหน้า
        emphasis ? "-mx-3 bg-peach-100 px-3" : "",
      )}
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(kind, e.target.checked)}
        className="mt-0.5 size-5 min-h-0 shrink-0 accent-brown-700"
      />
      <span className="flex flex-col gap-1">
        <span className={cn("leading-relaxed", emphasis ? "font-medium text-ink-900" : "text-ink-600")}>
          {label}
          {optional && (
            <span className="ml-1.5 rounded-[5px] bg-cream-100 px-1.5 py-px text-[11px] text-ink-400">
              ไม่บังคับ
            </span>
          )}
        </span>
        {detail && <span className="text-xs leading-relaxed text-ink-600">{detail}</span>}
      </span>
    </label>
  );
}
