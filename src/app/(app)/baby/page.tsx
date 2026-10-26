import { redirect } from "next/navigation";
import Link from "next/link";
import { Baby, ChevronRight } from "lucide-react";
import { listChildren, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ChildForm } from "@/components/baby/child-form";
import { ageLabel } from "@/lib/child-age";
import { localToday } from "@/lib/local-time";

export const metadata = { title: "สมุดรูปของลูก · Pre Care" };

export default async function BabyListPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const kids = await listChildren(ctx.db, ctx.familyId);
  const canWrite = can.writeRecords(ctx.role);
  const today = localToday();

  return (
    <div className="flex flex-col gap-3 pb-20">
      <h1 className="text-2xl font-semibold text-ink-900">สมุดรูปของลูก</h1>

      {kids.length === 0 ? (
        <EmptyState
          icon={Baby}
          title="ยังไม่ได้เพิ่มลูก"
          description="เพิ่มชื่อกับวันเกิด แล้วรูปที่อัปจะเรียงเข้าช่องอายุให้เองตั้งแต่แรกเกิดถึง 3 ขวบ"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {kids.map((k) => (
            <li key={k.id}>
              <Link href={`/baby/${k.id}`} className="block">
                <Card className="flex items-center justify-between gap-3">
                  <span className="flex flex-col">
                    <span className="font-medium text-ink-900">{k.name}</span>
                    <span className="text-[13px] text-ink-600">
                      {ageLabel(k.birthDate, today)} · {k.photoCount} รูป
                    </span>
                  </span>
                  <ChevronRight size={18} className="shrink-0 text-ink-400" />
                </Card>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <Card className="flex flex-col gap-3">
          <span className="font-medium text-ink-900">เพิ่มลูก</span>
          {/* ไม่สร้างให้อัตโนมัติเมื่อถึงกำหนดคลอด — ต้องมีคนกดเองเท่านั้น */}
          <ChildForm />
        </Card>
      )}
    </div>
  );
}
