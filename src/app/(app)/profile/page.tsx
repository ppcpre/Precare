import { redirect } from "next/navigation";
import Link from "next/link";
import { Baby, Bell, ChevronRight, Globe, Lock, Mail, Shield, Users } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { RoleBadge } from "@/components/ui/badge";
import { Avatar } from "@/components/app-topbar";
import { SignOutRow } from "@/components/profile/sign-out";
import { getFamily, getPregnancy, listMembers, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "โปรไฟล์ · Health Care" };

function Row({
  icon: Icon,
  label,
  value,
  href,
}: {
  icon: React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  label: string;
  value?: string;
  href?: string;
}) {
  const body = (
    <>
      <Icon size={20} strokeWidth={1.9} className="shrink-0 text-ink-600" />
      <span className="flex-1 text-ink-900">{label}</span>
      {value && <span className="text-sm text-ink-400">{value}</span>}
      {href && <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-ink-400" />}
    </>
  );
  const cls = "flex items-center gap-3 p-4";
  return href ? (
    <Link href={href} className={`${cls} hover:bg-cream-50`}>
      {body}
    </Link>
  ) : (
    <div className={cls}>{body}</div>
  );
}

export default async function ProfilePage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const { db, familyId, role, user } = ctx;
  const [family, members, preg] = await Promise.all([
    getFamily(db, familyId),
    listMembers(db, familyId, user.id),
    getPregnancy(db, familyId),
  ]);

  const canEditPregnancy = can.editPregnancy(role);

  return (
    <div className="flex flex-col gap-4 pb-4">
      <h1 className="text-2xl font-semibold text-ink-900">โปรไฟล์</h1>

      <Card className="items-start gap-4 rounded-lg p-5">
        <div className="flex w-full items-center gap-3.5">
          <Avatar name={user.name} image={user.image} size={64} />
          <div className="flex min-w-0 flex-col items-start gap-1.5">
            <span className="truncate text-lg font-semibold text-ink-900">{user.name}</span>
            <span className="truncate text-[13px] text-ink-600">{user.email}</span>
            <RoleBadge role={role} />
          </div>
        </div>
        <ButtonLink href="/profile/edit" variant="secondary" full>
          แก้ไขโปรไฟล์
        </ButtonLink>
      </Card>

      {/* ครอบครัวย้ายมาอยู่ที่นี่แล้ว ไม่อยู่ใน bottom nav */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-600">ครอบครัว</h2>
        <Card className="gap-0 p-0">
          <Link href="/family" className="flex items-center gap-3 p-4 hover:bg-cream-50">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-brown-100">
              <Users size={21} strokeWidth={1.8} className="text-brown-700" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="truncate font-medium text-ink-900">{family?.name}</span>
              <span className="text-[13px] text-ink-600">
                สมาชิก {members.length} คน · คุณเป็น{role === "owner" ? "เจ้าของ" : "สมาชิก"}
              </span>
            </span>
            <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-ink-400" />
          </Link>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="flex items-center gap-1.5 text-sm text-ink-600">
          <span aria-hidden className="size-[6px] rounded-full bg-peach-500" />
          Pre Care · การตั้งครรภ์
        </h2>
        <Card className="gap-0 p-0">
          {/* owner เท่านั้นที่แตะเข้าไปแก้ได้ คนอื่นเห็นเป็นข้อมูลอย่างเดียว */}
          <Row
            icon={Baby}
            label="วันตั้งครรภ์และวันคาดคลอด"
            value={preg.ga ? `${preg.ga.weeks} สัปดาห์` : "ยังไม่ตั้งค่า"}
            href={canEditPregnancy ? "/profile/pregnancy" : undefined}
          />
          {preg.profile?.lmpDate && (
            <>
              <span className="h-px bg-cream-200" />
              <div className="flex justify-between px-4 py-3 text-sm">
                <span className="text-ink-600">วันประจำเดือนครั้งสุดท้าย</span>
                <span className="font-medium text-ink-900">{thaiDate(preg.profile.lmpDate)}</span>
              </div>
              <div className="flex justify-between px-4 pb-4 text-sm">
                <span className="text-ink-600">วันคาดคลอด</span>
                <span className="font-medium text-ink-900">
                  {preg.profile.dueDate ? thaiDate(preg.profile.dueDate) : "—"}
                </span>
              </div>
            </>
          )}
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-600">การแจ้งเตือน</h2>
        <Card className="gap-3">
          <div className="flex items-center gap-3">
            <Bell size={20} strokeWidth={1.9} className="shrink-0 text-ink-600" />
            <span className="flex-1 text-ink-900">แจ้งเตือนนัดหมาย</span>
          </div>
          <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
            แจ้งเตือนทำงานเฉพาะตอนเปิดแอปค้างไว้ ถ้าปิดแท็บจะไม่เตือน
            <br />
            ตั้งค่าการเตือนของแต่ละนัดได้ในหน้านัดหมาย
          </p>
        </Card>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm text-ink-600">บัญชีและอื่นๆ</h2>
        <Card className="gap-0 p-0">
          <Row icon={Mail} label="อีเมล" value={user.email} />
          <span className="h-px bg-cream-200" />
          <Row icon={Lock} label="เปลี่ยนรหัสผ่าน" value="เร็วๆ นี้" />
          <span className="h-px bg-cream-200" />
          <Row icon={Globe} label="ภาษา" value="ไทย" />
          <span className="h-px bg-cream-200" />
          <Row icon={Shield} label="นโยบายความเป็นส่วนตัว" href="/privacy" />
        </Card>
      </section>

      <Card className="gap-0 p-0">
        <SignOutRow />
      </Card>
    </div>
  );
}
