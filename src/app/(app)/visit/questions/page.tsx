import { redirect } from "next/navigation";
import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { QuestionList } from "@/components/visit/question-list";
import { listVisitQuestions, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";

export const metadata = { title: "คำถามที่อยากถาม · Pre Care" };

export default async function VisitQuestionsPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const items = await listVisitQuestions(ctx.db, ctx.familyId);

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-2">
        <Link
          href="/visit"
          aria-label="กลับ"
          className="-ml-2 flex size-11 items-center justify-center rounded-sm text-ink-600"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">คำถามที่อยากถาม</h1>
      </header>

      {/* เรื่องที่คนลืมถามหมอมากที่สุดคือเรื่องที่นึกได้ตอนอยู่บ้าน */}
      <p className="rounded-md border border-cream-200 bg-cream-100 p-3.5 text-[13px] leading-relaxed text-ink-600">
        จดไว้ตอนไหนก็ได้ แล้วเปิดดูตอนอยู่ในห้องตรวจ
      </p>

      <QuestionList items={items} canWrite={can.writeRecords(ctx.role)} />
    </div>
  );
}
