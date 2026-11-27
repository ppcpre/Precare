"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Copy, Check, ShieldCheck, Eye, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { createInvite } from "@/actions/invites";
import { thaiDate } from "@/lib/format";
import { cn } from "@/lib/cn";

const ROLE_CARDS = [
  {
    value: "editor" as const,
    icon: ShieldCheck,
    title: "แก้ไขได้",
    desc: "เพิ่มและแก้ไขบันทึกสุขภาพ นัดหมายได้ แต่แก้วันตั้งครรภ์และเชิญสมาชิกไม่ได้",
  },
  {
    value: "viewer" as const,
    icon: Eye,
    title: "ดูอย่างเดียว",
    desc: "ดูข้อมูลทั้งหมดได้ แต่แก้ไขอะไรไม่ได้",
  },
];

export function InviteForm({ origin }: { origin: string }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"editor" | "viewer">("editor");
  const [copied, setCopied] = useState(false);

  const { execute, isPending, result, reset } = useAction(createInvite);
  const created = result.data;
  const link = created ? `${origin}/invite/${created.inviteId}` : "";

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="flex h-14 items-center gap-3 border-b border-cream-200 bg-white px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="ปิด"
          className="flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <X size={22} strokeWidth={1.8} />
        </button>
        <h1 className="font-semibold text-ink-900">เชิญสมาชิก</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-5 p-4">
        {!created ? (
          <>
            <Field
              label="อีเมลผู้ถูกเชิญ"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={result.serverError ?? undefined}
            />

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600">ให้สิทธิ์ระดับไหน</span>
              {/* การ์ดเลือก ไม่ใช้ dropdown — ผู้ใช้ต้องอ่านออกว่าแต่ละ role ทำอะไรได้ */}
              <div className="flex flex-col gap-2">
                {ROLE_CARDS.map(({ value, icon: Icon, title, desc }) => (
                  <button
                    key={value}
                    type="button"
                    role="radio"
                    aria-checked={role === value}
                    onClick={() => setRole(value)}
                    className={cn(
                      "flex h-auto min-h-0 items-start gap-3 rounded-md border p-4 text-left transition-colors",
                      role === value
                        ? "border-[1.5px] border-brown-500 bg-brown-100"
                        : "border-cream-200 bg-white",
                    )}
                  >
                    <Icon
                      size={20}
                      strokeWidth={1.8}
                      className={cn("mt-0.5 shrink-0", role === value ? "text-brown-700" : "text-ink-600")}
                    />
                    <span className="flex flex-col gap-1">
                      <span className="font-medium text-ink-900">{title}</span>
                      <span className="text-[13px] leading-relaxed text-ink-600">{desc}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              full
              loading={isPending}
              disabled={!email.includes("@")}
              onClick={() => execute({ email, role })}
            >
              สร้างลิงก์เชิญ
            </Button>
          </>
        ) : (
          <>
            <div className="flex flex-col gap-1.5">
              <h2 className="text-xl font-semibold text-ink-900">สร้างลิงก์แล้ว</h2>
              <p className="text-sm leading-relaxed text-ink-600">
                คัดลอกลิงก์แล้วส่งให้ <strong className="text-ink-900">{email}</strong> ทาง LINE หรือแชทได้เลย
                <br />
                <span className="text-ink-400">ระบบยังไม่ส่งอีเมลให้อัตโนมัติ</span>
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600">ลิงก์คำเชิญ</span>
              <div className="flex gap-2">
                <span className="flex h-11 flex-1 items-center overflow-hidden rounded-sm border border-cream-200 bg-cream-100 px-3 text-sm text-ink-600">
                  <span className="truncate">{link}</span>
                </span>
                <button
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(link);
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="flex h-11 shrink-0 items-center gap-1.5 rounded-sm bg-brown-700 px-4 text-sm font-medium text-white"
                >
                  {copied ? <Check size={16} strokeWidth={2.2} /> : <Copy size={16} strokeWidth={1.9} />}
                  {copied ? "คัดลอกแล้ว" : "คัดลอก"}
                </button>
              </div>
              <p className="text-xs text-ink-400">
                ลิงก์นี้ใช้ได้ถึง {thaiDate(created.expiresAt)} และใช้ได้ครั้งเดียว
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Button
                variant="ghost"
                onClick={() => {
                  reset();
                  setEmail("");
                }}
              >
                เชิญคนอื่นอีก
              </Button>
              <Button
                variant="secondary"
                onClick={() => {
                  router.push("/family");
                  router.refresh();
                }}
              >
                กลับไปหน้าครอบครัว
              </Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
