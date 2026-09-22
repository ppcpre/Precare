import { redirect } from "next/navigation";
import Link from "next/link";
import { Footprints, HeartPulse, Plus } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { LogCard } from "@/components/health/log-card";
import { listWeeklyLogs, requireFamilyContext } from "@/lib/queries";
import { can } from "@/lib/authz";

export const metadata = { title: "บันทึกสุขภาพ · Pre Care" };

const M_FULL =
  "มกราคม กุมภาพันธ์ มีนาคม เมษายน พฤษภาคม มิถุนายน กรกฎาคม สิงหาคม กันยายน ตุลาคม พฤศจิกายน ธันวาคม".split(" ");

export default async function HealthPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const logs = await listWeeklyLogs(ctx.db, ctx.familyId);
  const canWrite = can.writeRecords(ctx.role);

  // จัดกลุ่มตามเดือน ตาม screen-blueprint §6.2
  const groups = new Map<string, typeof logs>();
  for (const l of logs) {
    const d = new Date(l.logDate);
    const key = `${M_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
    const arr = groups.get(key) ?? [];
    arr.push(l);
    groups.set(key, arr);
  }

  return (
    <div className="flex flex-col gap-4 pb-20">
      <header className="flex items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold text-ink-900">บันทึกสุขภาพ</h1>
        <div className="flex shrink-0 items-center gap-2">
          {/* ทางเข้านับลูกดิ้น
              เดิมมีทางเดียวคือการ์ดบนหน้าแรก ซึ่งโผล่ตั้งแต่สัปดาห์ 28 เท่านั้น
              ใครที่ไม่ได้เลื่อนหน้าแรกจึงไม่รู้ว่ามีฟีเจอร์นี้อยู่

              แสดงตลอด ไม่รอสัปดาห์ 28 — หน้า /kicks อธิบายเองอยู่แล้วว่าทำไม
              ยังนับไม่ได้ และบอกทางไปหาหมอถ้าลูกดิ้นน้อยลง การซ่อนปุ่มไว้
              ทำให้คนไม่รู้ว่ามีของนี้ ซึ่งแย่กว่าเห็นแล้วกดไปเจอคำอธิบาย */}
          <Link
            href="/kicks"
            className="flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-brown-700 hover:bg-cream-100"
          >
            <Footprints size={17} strokeWidth={1.9} />
            นับลูกดิ้น
          </Link>
        {/* ครอบด้วย span แทนการใส่ hidden ลงบนปุ่มตรงๆ — cn() เป็นแค่ join
            ไม่ได้ merge class ที่ชนกัน ตัวปุ่มมี inline-flex เป็น base อยู่แล้ว
            พอเติม hidden เข้าไปทั้งคู่จะอยู่ใน class list แล้วลำดับใน CSS
            เป็นตัวตัดสิน ซึ่ง inline-flex ชนะ ปุ่มเลยโผล่บนมือถือคู่กับ FAB */}
          {canWrite && (
            <span className="hidden md:block">
              <ButtonLink href="/health/new" variant="secondary">
                <Plus size={18} strokeWidth={2} />
                เพิ่มบันทึก
              </ButtonLink>
            </span>
          )}
        </div>
      </header>

      {logs.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="ยังไม่มีบันทึกสุขภาพ"
          description="บันทึกน้ำหนัก ความดัน และอาการในแต่ละสัปดาห์ เพื่อดูแนวโน้มและแชร์กับคุณหมอ"
          action={
            canWrite ? <ButtonLink href="/health/new">บันทึกครั้งแรก</ButtonLink> : undefined
          }
        />
      ) : (
        [...groups].map(([month, items]) => (
          <section key={month} className="flex flex-col gap-3">
            <h2 className="sticky top-0 z-10 bg-cream-50 py-1 text-sm text-ink-600">{month}</h2>
            {items.map((l) => (
              <LogCard key={l.id} log={l} recorderName={l.recorderName} canEdit={canWrite} />
            ))}
          </section>
        ))
      )}

      {/* FAB ซ่อนทั้งปุ่มเมื่อ viewer */}
      {canWrite && (
        <Link
          href="/health/new"
          aria-label="เพิ่มบันทึกสุขภาพ"
          className="fixed bottom-20 right-4 flex size-14 items-center justify-center rounded-full bg-brown-700 text-white shadow-[0_4px_12px_rgba(43,36,32,0.18)] md:hidden"
        >
          <Plus size={26} strokeWidth={2} />
        </Link>
      )}
    </div>
  );
}
