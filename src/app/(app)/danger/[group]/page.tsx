import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { ChevronLeft, Phone } from "lucide-react";
import {
  DANGER_GROUPS,
  DISCLAIMER,
  SELF_HARM,
  findGroup,
  signsFor,
  type Phase,
} from "@/data/danger-signs";
import { EmsButton, HospitalButton } from "@/components/danger/call-buttons";
import { SignList } from "@/components/danger/sign-list";
import { getPregnancy, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";

export const metadata = { title: "อาการที่ต้องไปโรงพยาบาล · Pre Care" };

/** สร้างทั้งสามหน้าไว้ล่วงหน้า — เนื้อหาเป็น static ไม่มีอะไรต้องรอ */
export function generateStaticParams() {
  return DANGER_GROUPS.map((g) => ({ group: g.id }));
}

export default async function DangerGroupPage({
  params,
}: {
  params: Promise<{ group: string }>;
}) {
  const { group: groupId } = await params;
  const group = findGroup(groupId);
  if (!group) notFound();

  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  /**
   * อ่านข้อมูลครรภ์เฉพาะหมวดคนท้อง — อีกสองหมวดไม่ต้องแตะ D1 เลย
   * ยิงคิวรีที่ไม่ได้ใช้ในหน้าฉุกเฉินคือการเพิ่มจุดที่พังได้โดยไม่ได้อะไร
   */
  const preg = group.showHospital ? await getPregnancy(ctx.db, ctx.familyId) : null;
  const phase: Phase = preg?.profile?.status === "postpartum" ? "postpartum" : "pregnant";

  return (
    <div className="flex flex-col gap-3.5 pb-8">
      <div className="flex items-center gap-1">
        <Link
          href="/danger"
          aria-label="ย้อนกลับ"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-900"
        >
          <ChevronLeft size={26} strokeWidth={2.2} />
        </Link>
        <h1 className="text-xl font-semibold text-ink-900">{group.name}</h1>
      </div>

      <div className="flex flex-col gap-2">
        {group.showHospital && (
          <HospitalButton
            name={preg?.profile?.hospitalName ?? null}
            phone={preg?.profile?.hospitalPhone ?? null}
            canEdit={can.editPregnancy(ctx.role)}
          />
        )}
        <EmsButton big={!group.showHospital} />
      </div>

      {group.sections.map((section) => {
        const signs = signsFor(section, phase);
        if (signs.length === 0) return null;
        return <SignList key={section.id} section={section} signs={signs} />;
      })}

      {/* ข้อสุขภาพจิตอยู่ท้ายสุดและแยกกล่อง — เบอร์คนละเบอร์ และคนที่มาด้วย
          เรื่องนี้ไม่ได้กำลังมองหาอาการทางกาย */}
      {group.showHospital && (
        <section className="flex flex-col gap-2.5 rounded-xl border-[1.5px] border-sage-500 bg-sage-100 p-4">
          <h2 className="text-lg font-bold leading-snug text-ink-900">{SELF_HARM.title}</h2>
          <a
            href={`tel:${SELF_HARM.phone}`}
            className="flex h-[60px] items-center justify-center gap-2.5 rounded-xl bg-sage-700 text-[19px] font-bold text-white"
          >
            <Phone size={21} strokeWidth={2.2} aria-hidden />
            โทร {SELF_HARM.phone}
          </a>
          <p className="text-[15px] leading-relaxed text-ink-600">{SELF_HARM.phoneNote}</p>
        </section>
      )}

      {group.footer && (
        <p className="rounded-xl bg-cream-100 px-4 py-3.5 text-base leading-relaxed text-ink-900">
          {group.footer}
        </p>
      )}

      <p className="text-xs leading-relaxed text-ink-400">{DISCLAIMER}</p>
    </div>
  );
}
