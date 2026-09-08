"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { deleteAccount, setOptionalConsent } from "@/actions/consent";
import { signOut } from "@/lib/auth-client";
import { CONSENT_LABEL } from "@/lib/consent";
import { cn } from "@/lib/cn";

/**
 * ส่วนที่แก้ไขได้ในหน้าความเป็นส่วนตัว
 *
 * แยกออกมาเป็น client component เพราะสองอย่างนี้ต้องมีสถานะฝั่งหน้าจอ
 * ที่เหลือในหน้าเป็นข้อมูลอ่านอย่างเดียว จึงยังเป็น server component ได้
 */
export function PrivacyControls({
  email,
  marketingOn,
  blockedByOwnership,
}: {
  email: string;
  marketingOn: boolean;
  blockedByOwnership: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(marketingOn);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [typed, setTyped] = useState("");

  const optional = useAction(setOptionalConsent, {
    onError: () => setOn((v) => !v),
    onSuccess: () => router.refresh(),
  });
  const remove = useAction(deleteAccount, {
    /**
     * ลบสำเร็จแล้วต้อง signOut ก่อน ไม่ใช่แค่พาไปหน้า login
     *
     * แถว user ถูกลบไปแล้วก็จริง แต่ cookie ยังอยู่ในเบราว์เซอร์
     * middleware ดูแค่ว่ามี cookie ไหม จึงจะปล่อยผ่านแล้วไปเจอ redirect
     * อีกทอดหนึ่ง ซึ่งทำงานได้แต่ทิ้ง cookie ค้างไว้โดยไม่จำเป็น
     */
    onSuccess: async () => {
      await signOut().catch(() => null);
      router.replace("/login");
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
        <button
          type="button"
          role="switch"
          aria-checked={on}
          aria-label={CONSENT_LABEL.marketing}
          onClick={() => {
            const next = !on;
            setOn(next);
            optional.execute({ kind: "marketing", granted: next });
          }}
          className={cn(
            "flex h-6.5 w-11 min-h-0 shrink-0 items-center rounded-full p-[3px] transition-colors",
            on ? "justify-end bg-brown-700" : "justify-start bg-cream-200",
          )}
        >
          <span className="size-5 rounded-full bg-white" />
        </button>
        <span className="flex flex-col">
          <span className="text-[15px] text-ink-900">{CONSENT_LABEL.marketing}</span>
          <span className="text-xs text-ink-600">
            ปิดได้ทุกเมื่อ ไม่กระทบการใช้งานอื่น
          </span>
        </span>
      </div>

      <section className="flex flex-col gap-3 rounded-md border border-danger bg-white p-3.5">
        <h2 className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
          <AlertTriangle size={18} strokeWidth={2} className="text-danger" />
          ลบบัญชีและข้อมูลทั้งหมด
        </h2>

        {/* บอกให้ครบก่อนกด ไม่ใช่หลังกด — ลบแล้วย้อนไม่ได้จริงๆ */}
        <ul className="flex list-disc flex-col gap-1 pl-5 text-[13px] leading-relaxed text-ink-600">
          <li>บันทึกสุขภาพ นัดหมาย รูป วิดีโอ และการจับเวลาทั้งหมดจะถูกลบ</li>
          <li>
            <span className="font-medium text-ink-900">ลบทันทีและถาวร ไม่มีช่วงกู้คืน</span>
          </li>
          <li>สิ่งที่เก็บไว้ต่อคือบันทึกว่าเคยให้ความยินยอมเมื่อไหร่ ซึ่งไม่มีชื่อหรืออีเมลอยู่ในนั้น</li>
        </ul>

        {blockedByOwnership ? (
          <p className="rounded-sm border border-warning bg-cream-100 px-3 py-2.5 text-[13px] leading-relaxed text-ink-900">
            คุณเป็นเจ้าของครอบครัวที่ยังมีสมาชิกคนอื่นอยู่ — ต้องโอนสิทธิ์เจ้าของให้คนอื่น
            หรือลบครอบครัวก่อน ถึงจะลบบัญชีได้
            <br />
            <span className="text-ink-600">
              ปล่อยให้ครอบครัวไม่มีเจ้าของไม่ได้ เพราะจะไม่มีใครเชิญหรือถอดสมาชิกได้อีก
            </span>
          </p>
        ) : !confirmOpen ? (
          <Button variant="ghost" onClick={() => setConfirmOpen(true)}>
            ลบบัญชี
          </Button>
        ) : (
          <div className="flex flex-col gap-3">
            <Field
              label="พิมพ์อีเมลของคุณเพื่อยืนยัน"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={email}
              autoComplete="off"
            />
            {remove.result.serverError && (
              <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
                {remove.result.serverError}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variant="ghost"
                loading={remove.isPending}
                disabled={typed.trim().toLowerCase() !== email.toLowerCase()}
                onClick={() => remove.execute({ confirmEmail: typed })}
              >
                ลบบัญชีถาวร
              </Button>
              <Button variant="secondary" onClick={() => setConfirmOpen(false)}>
                ยกเลิก
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
