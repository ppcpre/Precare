import Link from "next/link";
import { AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/app-topbar";
import { Logo } from "@/components/logo";
import { AcceptInvite } from "@/components/family/accept-invite";
import { getInvitePreview } from "@/actions/invites";
import { getDb } from "@/db";
import { getSessionUser } from "@/lib/session";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "คำเชิญเข้าร่วมครอบครัว · Health Care" };

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-cream-50 px-6 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-5">{children}</div>
    </div>
  );
}

function Problem({ title, detail }: { title: string; detail: string }) {
  return (
    <Card className="items-center gap-3 rounded-lg p-6 text-center">
      <AlertCircle size={40} strokeWidth={1.6} className="mx-auto text-warning" />
      <h1 className="text-xl font-semibold text-ink-900">{title}</h1>
      <p className="text-sm leading-relaxed text-ink-600">{detail}</p>
      <ButtonLink href="/" variant="secondary" full>
        ไปหน้าแรก
      </ButtonLink>
    </Card>
  );
}

export default async function AcceptInvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const db = await getDb();
  const inv = await getInvitePreview(db, token);

  if (!inv) {
    return (
      <Shell>
        <Problem
          title="ไม่พบคำเชิญนี้"
          detail="ลิงก์อาจไม่ถูกต้อง หรือถูกยกเลิกไปแล้ว ลองขอลิงก์ใหม่จากเจ้าของครอบครัว"
        />
      </Shell>
    );
  }
  if (inv.status !== "pending" || inv.isExpired) {
    return (
      <Shell>
        <Problem
          title={inv.status === "accepted" ? "คำเชิญนี้ถูกใช้ไปแล้ว" : "คำเชิญหมดอายุแล้ว"}
          detail={
            inv.status === "accepted"
              ? "ลิงก์เชิญใช้ได้ครั้งเดียว ถ้ายังเข้าไม่ได้ให้ขอลิงก์ใหม่"
              : `ลิงก์นี้หมดอายุเมื่อ ${thaiDate(inv.expiresAt)} ขอลิงก์ใหม่จากเจ้าของครอบครัวได้เลย`
          }
        />
      </Shell>
    );
  }

  const me = await getSessionUser();
  const mismatch = me && me.email.toLowerCase() !== inv.email;

  return (
    <Shell>
      <Logo size={44} className="mx-auto" />

      <Card className="items-center gap-4 rounded-lg p-6 text-center">
        <Avatar name={inv.inviterName} size={60} />
        <div className="flex flex-col gap-1.5">
          <p className="text-lg leading-relaxed font-semibold text-ink-900">
            {inv.inviterName}
            <span className="block text-base font-normal text-ink-600">
              เชิญคุณเข้าร่วมครอบครัว
            </span>
          </p>
          <p className="text-xl font-semibold text-brown-700">{inv.familyName}</p>
        </div>

        <span className="h-px w-full bg-cream-200" />

        <div className="flex w-full items-center justify-between">
          <span className="text-sm text-ink-600">สิทธิ์ที่จะได้รับ</span>
          <RoleBadge role={inv.role} />
        </div>
        <p className="text-[13px] leading-relaxed text-ink-600">
          {inv.role === "editor"
            ? "เพิ่มและแก้ไขบันทึกสุขภาพ นัดหมายได้ แต่แก้วันตั้งครรภ์และเชิญสมาชิกไม่ได้"
            : "ดูข้อมูลทั้งหมดได้ แต่แก้ไขอะไรไม่ได้"}
        </p>
      </Card>

      {!me ? (
        <div className="flex flex-col gap-2">
          <ButtonLink href={`/login?next=/invite/${token}`} full>
            เข้าสู่ระบบเพื่อรับคำเชิญ
          </ButtonLink>
          <ButtonLink href={`/signup?next=/invite/${token}`} variant="secondary" full>
            สมัครสมาชิก
          </ButtonLink>
          <p className="text-center text-xs text-ink-400">
            คำเชิญนี้ส่งถึง {inv.email} — ต้องเข้าสู่ระบบด้วยอีเมลนี้
          </p>
        </div>
      ) : mismatch ? (
        /* กันคนที่ได้ลิงก์ต่อมาใช้ — ต้องเป็นอีเมลที่ถูกเชิญเท่านั้น */
        <Card className="gap-3 border-warning bg-cream-100">
          <p className="text-sm leading-relaxed text-ink-900">
            คำเชิญนี้ส่งถึง <strong>{inv.email}</strong> แต่คุณเข้าสู่ระบบด้วย{" "}
            <strong>{me.email}</strong>
          </p>
          <p className="text-[13px] text-ink-600">
            ออกจากระบบแล้วเข้าใหม่ด้วยอีเมลที่ได้รับเชิญ หรือขอให้เจ้าของครอบครัวส่งคำเชิญไปที่อีเมลนี้แทน
          </p>
          <Link href="/profile" className="text-sm font-medium text-brown-700">
            ไปหน้าโปรไฟล์เพื่อออกจากระบบ
          </Link>
        </Card>
      ) : (
        <AcceptInvite token={token} />
      )}

      <p className="text-center text-xs text-ink-400">
        ลิงก์นี้ใช้ได้ถึง {thaiDate(inv.expiresAt)}
      </p>
    </Shell>
  );
}
