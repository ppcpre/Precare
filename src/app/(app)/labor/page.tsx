import { redirect } from "next/navigation";
import { AlertCircle, Waves } from "lucide-react";
import { can } from "@/lib/authz";
import { getActiveLaborSession, getDashboard, listLaborSessions, requireFamilyContext } from "@/lib/queries";
import { START_WEEK, clock } from "@/lib/labor";
import { LaborTimer } from "@/components/labor/timer";
import { StartLaborButton } from "@/components/labor/start-button";
import { thaiDate } from "@/lib/format";

export const metadata = { title: "จับเวลาการบีบตัว · Pre Care" };

/**
 * อาการที่ต้องไปโรงพยาบาลทันทีโดยไม่ต้องรอครบเกณฑ์
 *
 * ต้องอยู่ในหน้า ไม่ใช่ซ่อนใน help — คนเปิดหน้านี้ตอนกำลังตัดสินใจ
 * และเกณฑ์ 5-1-1 ไม่ครอบคลุมอาการเหล่านี้เลยสักข้อ
 */
const GO_NOW = [
  "น้ำเดิน หรือมีน้ำไหลออกมา",
  "เลือดออกทางช่องคลอด",
  "ลูกดิ้นน้อยลงหรือหยุดดิ้น",
  "ปวดหัวมาก ตาพร่า หรือบวมขึ้นเร็ว",
];

export default async function LaborPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const [active, sessions, dash] = await Promise.all([
    getActiveLaborSession(ctx.db, ctx.familyId),
    listLaborSessions(ctx.db, ctx.familyId),
    getDashboard(ctx.db, ctx.familyId),
  ]);

  const canEdit = can.writeRecords(ctx.role);
  const week = dash.ga?.weeks ?? null;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex items-center gap-2">
        <h1 className="flex items-center gap-2 text-2xl font-semibold text-ink-900">
          <Waves size={22} strokeWidth={1.9} className="text-peach-700" />
          จับเวลาการบีบตัว
        </h1>
      </header>

      {active ? (
        <LaborTimer session={active} canEdit={canEdit} />
      ) : (
        <StartPanel week={week} canEdit={canEdit} />
      )}

      {/* ต้องอยู่ทุกสถานะ รวมถึงตอนยังไม่ถึงสัปดาห์ที่เปิดให้จับเวลา */}
      <section className="flex flex-col gap-2.5 rounded-md border border-cream-300 bg-cream-100 p-3.5">
        <p className="text-sm font-medium text-ink-900">
          ไปโรงพยาบาลทันที ไม่ต้องรอครบเกณฑ์ ถ้ามีอาการเหล่านี้
        </p>
        {GO_NOW.map((s) => (
          <p key={s} className="flex items-start gap-2 text-[13px] text-ink-600">
            <span aria-hidden className="mt-1.5 size-1.5 shrink-0 rounded-full bg-danger" />
            {s}
          </p>
        ))}
      </section>

      {sessions.length > 0 && !active && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-ink-600">รอบที่ผ่านมา</h2>
          {sessions.map((s) => (
            <div
              key={s.id}
              className="flex items-center justify-between gap-3 rounded-md border border-cream-200 bg-white p-3 shadow-[var(--shadow-card)]"
            >
              <span className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-sm text-ink-900">
                  {thaiDate(s.startedAt)} · {s.startedAt.slice(11, 16)}
                </span>
                <span className="text-[11px] text-ink-400">{s.count} ครั้ง</span>
              </span>
              <span className="text-[15px] font-semibold tabular-nums text-ink-900">
                {s.durationMs != null ? clock(s.durationMs) : "—"}
              </span>
            </div>
          ))}
          <p className="flex items-start gap-2 rounded-md border border-cream-200 bg-cream-100 p-3 text-xs leading-relaxed text-ink-600">
            <AlertCircle size={15} strokeWidth={1.9} className="mt-px shrink-0 text-ink-400" />
            ท้องแข็งเป็นพักๆ ที่ไม่ถี่ขึ้นและไม่แรงขึ้น มักเป็นการบีบตัวเตือน ซึ่งพบได้ทั่วไปในช่วงท้าย
          </p>
        </section>
      )}
    </div>
  );
}

function StartPanel({ week, canEdit }: { week: number | null; canEdit: boolean }) {
  /**
   * ก่อนสัปดาห์ที่กำหนด การบีบตัวเตือนยังไม่เป็นจังหวะ จับเวลาไปก็ตีความไม่ได้
   *
   * ⚠️ หน้านี้ต้อง **พาไปหาหมอ** ไม่ใช่แค่บอกว่ายังไม่ถึงเวลา
   *    ถ้าท้องแข็งถี่ผิดปกติก่อนสัปดาห์นี้ นั่นคือเรื่องที่ต้องไปตรวจ
   */
  if (week != null && week < START_WEEK) {
    return (
      <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
        <div className="flex items-center justify-between gap-2">
          <span className="text-[15px] font-medium text-ink-900">ยังไม่ถึงช่วงที่จับเวลาได้</span>
          <span className="rounded-full bg-cream-100 px-3 py-1 text-xs text-ink-600">
            เริ่มสัปดาห์ที่ {START_WEEK}
          </span>
        </div>
        <p className="text-[13px] leading-relaxed text-ink-600">
          ตอนนี้อายุครรภ์ {week} สัปดาห์ การบีบตัวช่วงนี้ยังไม่เป็นจังหวะ จับเวลาไปก็ยังตีความไม่ได้
        </p>
        <p className="text-[13px] font-medium leading-relaxed text-ink-900">
          ถ้าท้องแข็งถี่ผิดปกติ เจ็บมากขึ้นเรื่อยๆ หรือมีอาการข้างล่างนี้ ให้ติดต่อโรงพยาบาลเลย
          ไม่ต้องรอถึงสัปดาห์ที่ {START_WEEK}
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
      <p className="text-[13px] leading-relaxed text-ink-600">
        ใช้ตอนเริ่มรู้สึกท้องแข็งเป็นจังหวะ ระบบจะจับความนานและระยะห่างให้
        แล้วบอกว่าตรงกับเกณฑ์ที่ตำราใช้หรือยัง
      </p>
      {canEdit ? (
        <StartLaborButton />
      ) : (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
          คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้
        </p>
      )}
    </div>
  );
}
