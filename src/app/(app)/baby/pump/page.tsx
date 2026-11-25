import Link from "next/link";
import { redirect } from "next/navigation";
import { X } from "lucide-react";
import { getChild, requireFamilyContext } from "@/lib/queries";
import { lastPump } from "@/lib/baby-queries";
import { PumpForm } from "@/components/baby/log/pump-form";

export const metadata = { title: "ปั๊มนม · Pre Care" };

export default async function PumpPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const sp = await searchParams;
  let ctx;
  try {
    ctx = await requireFamilyContext("editor");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    // viewer ปั๊มนมไม่ได้ — กลับหน้าแรก ไม่ใช่หน้า error
    redirect("/dashboard");
  }
  // ?child= ใช้แค่เป็นปลายทางของปุ่มกลับ — ตรวจว่าเป็นลูกของบ้านนี้ก่อนใช้
  const [child, last] = await Promise.all([
    sp.child ? getChild(ctx.db, ctx.familyId, sp.child) : null,
    lastPump(ctx.db, ctx.familyId),
  ]);
  const back = child ? `/baby/${child.id}/log` : "/dashboard";

  return (
    <div className="flex flex-col gap-2">
      <header className="flex items-center justify-between">
        <Link
          href={back}
          aria-label="ปิด"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <X size={22} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">ปั๊มนม</h1>
        <span className="size-11" />
      </header>
      <PumpForm back={back} initialLeft={last?.leftMl ?? 0} initialRight={last?.rightMl ?? 0} />
    </div>
  );
}
