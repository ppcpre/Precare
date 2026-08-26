import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Plus, Users, Copy } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ButtonLink } from "@/components/ui/button";
import { RoleBadge, Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/app-topbar";
import { MemberActions } from "@/components/family/member-actions";
import { DeleteFamily, LeaveFamily } from "@/components/family/danger-zone";
import { getFamily, listMembers, listPendingInvites, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "ครอบครัว · Pre Care" };

export default async function FamilyPage() {
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
  const isOwner = can.manageMembers(role);
  const [family, members, invites] = await Promise.all([
    getFamily(db, familyId),
    listMembers(db, familyId, user.id),
    isOwner ? listPendingInvites(db, familyId) : Promise.resolve([]),
  ]);

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-1">
        {/* เข้ามาจากโปรไฟล์ จึงต้องมีปุ่มย้อนกลับ */}
        <Link
          href="/profile"
          aria-label="ย้อนกลับ"
          className="flex size-10 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </Link>
        <h1 className="text-2xl font-semibold text-ink-900">ครอบครัว</h1>
      </header>

      <Card className="gap-1 rounded-lg p-5">
        <h2 className="text-2xl font-semibold text-ink-900">{family?.name}</h2>
        <p className="text-sm text-ink-600">สมาชิก {members.length} คน</p>
      </Card>

      <section className="flex flex-col gap-2">
        <h3 className="text-sm text-ink-600">สมาชิก</h3>
        <Card className="gap-0 p-0">
          {members.map((m, i) => (
            <div
              key={m.id}
              className={`flex items-center gap-3 p-4 ${i > 0 ? "border-t border-cream-200" : ""}`}
            >
              <Avatar name={m.name} image={m.image} size={40} />
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="truncate font-medium text-ink-900">{m.name}</span>
                  {m.isMe && <span className="shrink-0 text-[13px] text-ink-400">(คุณ)</span>}
                </span>
                <span className="truncate text-xs text-ink-400">{m.email}</span>
              </div>
              <RoleBadge role={m.role} />
              {/* เมนู ⋮ เห็นเฉพาะ owner และไม่แสดงบนแถวตัวเอง */}
              {isOwner && !m.isMe ? (
                <MemberActions userId={m.userId} name={m.name} role={m.role} />
              ) : (
                <span className="w-8 shrink-0" />
              )}
            </div>
          ))}
        </Card>
      </section>

      {isOwner && invites.length > 0 && (
        <section className="flex flex-col gap-2">
          <h3 className="text-sm text-ink-600">คำเชิญที่รอตอบรับ</h3>
          <Card className="gap-0 p-0">
            {invites.map((inv, i) => {
              const expired = new Date(inv.expiresAt) < new Date(inv.createdAt);
              return (
                <div
                  key={inv.id}
                  className={`flex items-start justify-between gap-3 p-4 ${i > 0 ? "border-t border-cream-200" : ""}`}
                >
                  <div className="flex min-w-0 flex-col gap-1.5">
                    <span className="truncate font-medium text-ink-900">{inv.invitedEmail}</span>
                    <span className="flex flex-wrap items-center gap-2">
                      <RoleBadge role={inv.invitedRole} />
                      <span className="text-xs text-ink-400">
                        {expired ? "หมดอายุแล้ว" : `หมดอายุ ${thaiDate(inv.expiresAt)}`}
                      </span>
                    </span>
                  </div>
                  <Badge className="shrink-0">
                    <Copy size={12} strokeWidth={2} className="mr-1 inline" />
                    /invite/{inv.id.slice(0, 6)}…
                  </Badge>
                </div>
              );
            })}
          </Card>
        </section>
      )}

      {isOwner && (
        <ButtonLink href="/family/invite" full>
          <Plus size={18} strokeWidth={2} />
          เชิญสมาชิก
        </ButtonLink>
      )}

      <span className="my-1 h-px bg-cream-200" />

      {isOwner ? <DeleteFamily familyName={family?.name ?? ""} /> : <LeaveFamily />}

      <p className="flex items-center justify-center gap-1.5 pb-4 text-xs text-ink-400">
        <Users size={14} strokeWidth={1.9} />
        ทุกคนในครอบครัวเห็นข้อมูลสุขภาพและนัดหมายชุดเดียวกัน
      </p>
    </div>
  );
}
