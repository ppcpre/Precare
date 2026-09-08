import { redirect } from "next/navigation";
import Link from "next/link";
import { and, eq, isNull } from "drizzle-orm";
import { ChevronLeft, Download, FileText, ShieldCheck } from "lucide-react";
import { getDb } from "@/db";
import { consents, familyMembers } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import { CONSENT_LABEL, POLICY_VERSION, REQUIRED_KINDS, type ConsentKind } from "@/lib/consent";
import { PrivacyControls } from "@/components/profile/privacy-controls";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "ความเป็นส่วนตัว · Pre Care" };

export default async function PrivacyPage() {
  const me = await getSessionUser();
  if (!me) redirect("/login");

  const db = await getDb();
  const [rows, memberships] = await Promise.all([
    db
      .select({ kind: consents.kind, version: consents.version, grantedAt: consents.grantedAt })
      .from(consents)
      .where(and(eq(consents.userId, me.id), isNull(consents.revokedAt))),
    db
      .select({ familyId: familyMembers.familyId, role: familyMembers.role })
      .from(familyMembers)
      .where(and(eq(familyMembers.userId, me.id), eq(familyMembers.status, "active"))),
  ]);

  const given = new Map(rows.map((r) => [r.kind as ConsentKind, r]));
  /**
   * เป็นเจ้าของครอบครัวที่ยังมีคนอื่นอยู่ = ลบบัญชีไม่ได้
   * ต้องรู้ตั้งแต่ก่อนกดปุ่ม ไม่ใช่ให้กรอกอีเมลยืนยันแล้วค่อยโดนปฏิเสธ
   */
  const ownedIds = memberships.filter((m) => m.role === "owner").map((m) => m.familyId);
  let blockedByOwnership = false;
  for (const fid of ownedIds) {
    const others = await db
      .select({ id: familyMembers.id })
      .from(familyMembers)
      .where(and(eq(familyMembers.familyId, fid), eq(familyMembers.status, "active")))
      .limit(2);
    if (others.length > 1) blockedByOwnership = true;
  }

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-2">
        <Link
          href="/profile"
          aria-label="กลับ"
          className="-ml-2 flex size-11 items-center justify-center rounded-sm text-ink-600"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">ความเป็นส่วนตัว</h1>
      </header>

      <section className="flex flex-col gap-2.5 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
        <h2 className="flex items-center gap-1.5 text-[13px] text-ink-600">
          <ShieldCheck size={16} strokeWidth={1.9} className="text-ink-400" />
          ความยินยอมที่ให้ไว้
        </h2>
        {(Object.keys(CONSENT_LABEL) as ConsentKind[]).map((kind) => {
          const row = given.get(kind);
          return (
            <div key={kind} className="flex items-start justify-between gap-3 border-t border-cream-200 pt-2.5 first:border-0 first:pt-0">
              <span className="flex flex-col gap-0.5">
                <span className="text-sm text-ink-900">{CONSENT_LABEL[kind]}</span>
                <span className="text-xs text-ink-400">
                  {row
                    ? `ให้ไว้ ${thaiDate(row.grantedAt)} · เวอร์ชัน ${row.version}`
                    : "ยังไม่ได้ให้ความยินยอม"}
                </span>
              </span>
              {REQUIRED_KINDS.includes(kind) && (
                <span className="shrink-0 rounded-[5px] bg-cream-100 px-1.5 py-px text-[11px] text-ink-400">
                  จำเป็น
                </span>
              )}
            </div>
          );
        })}
        <p className="text-[11px] text-ink-400">นโยบายปัจจุบันคือเวอร์ชัน {POLICY_VERSION}</p>
        {/* แยกลิงก์ออกมาเป็นแถวของตัวเอง ไม่ปนอยู่ในประโยค
            ลิงก์ที่อยู่กลางย่อหน้าตัวเล็กสูงแค่ 17px ซึ่งต่ำกว่าเกณฑ์แตะ 44px
            (mobile-audit จับได้ตอนเพิ่มหน้านี้เข้าไปในลิสต์) */}
        <div className="-my-1 flex flex-wrap gap-x-4">
          <Link
            href="/legal/privacy"
            className="flex min-h-11 items-center text-[13px] font-medium text-brown-700"
          >
            นโยบายความเป็นส่วนตัว
          </Link>
          <Link
            href="/legal/data"
            className="flex min-h-11 items-center text-[13px] font-medium text-brown-700"
          >
            ข้อมูลที่เราเก็บ
          </Link>
        </div>
      </section>

      {/* ปุ่มดาวน์โหลดของจริง ไม่ใช่ปุ่มที่กดแล้วบอกให้ส่งอีเมลมาขอ */}
      <a
        href="/api/export"
        className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]"
      >
        <span className="flex items-center gap-2.5">
          <FileText size={18} strokeWidth={1.9} className="text-peach-700" />
          <span className="flex flex-col">
            <span className="text-[15px] font-medium text-ink-900">ดาวน์โหลดข้อมูลของฉัน</span>
            <span className="text-xs text-ink-400">ไฟล์ JSON · ไม่รวมตัวรูปและวิดีโอ</span>
          </span>
        </span>
        <Download size={18} strokeWidth={2} className="shrink-0 text-ink-400" />
      </a>

      <PrivacyControls
        email={me.email}
        marketingOn={given.has("marketing")}
        blockedByOwnership={blockedByOwnership}
      />
    </div>
  );
}
