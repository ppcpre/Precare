import { redirect } from "next/navigation";
import Link from "next/link";
import {
  Activity, AlertCircle, ChevronLeft, Footprints, HelpCircle, Scale, Stethoscope,
} from "lucide-react";
import { ButtonLink } from "@/components/ui/button";
import { getVisitData, countOpenQuestions, getDashboard, requireFamilyContext } from "@/lib/queries";
import { buildVisitSummary } from "@/lib/visit";
import { formatDuration } from "@/lib/kicks";
import { thaiDateFull } from "@/lib/format";
import { cn } from "@/lib/cn";

export const metadata = { title: "สรุปให้หมอดู · Pre Care" };

/**
 * หน้าสรุปก่อนพบแพทย์
 *
 * ข้อจำกัดที่กำหนดทุกอย่าง: **หมอมีเวลาต่อคนไม่ถึง 10 นาที**
 * หน้านี้ต้องอ่านจบใน 15 วินาที และอ่านจากระยะแขนได้ เพราะหมอมองจอเราจากอีกฝั่งโต๊ะ
 * ตัวเลขจึงใหญ่กว่าที่อื่นในแอป และของผิดปกติอยู่บนสุดเสมอ ไม่ใช่ให้หมอไล่หาเอง
 *
 * ⚠️ ชี้ให้ดู ไม่ใช่วินิจฉัย — เกณฑ์ทั้งหมดอยู่ใน src/lib/visit.ts พร้อมที่มา
 */
export default async function VisitPage() {
  let ctx;
  try {
    ctx = await requireFamilyContext("viewer");
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (msg === "UNAUTHENTICATED") redirect("/login");
    if (msg === "NO_ACTIVE_FAMILY") redirect("/onboarding");
    throw e;
  }

  const [data, openQuestions, dash] = await Promise.all([
    getVisitData(ctx.db, ctx.familyId),
    countOpenQuestions(ctx.db, ctx.familyId),
    getDashboard(ctx.db, ctx.familyId),
  ]);

  const s = buildVisitSummary({
    since: data.since,
    today: new Date().toISOString().slice(0, 10),
    logs: data.logs,
    sessions: data.sessions,
  });

  return (
    <div className="flex flex-col gap-4 pb-6">
      <header className="flex items-center gap-2">
        <Link
          href="/dashboard"
          aria-label="กลับ"
          className="-ml-2 flex size-11 items-center justify-center rounded-sm text-ink-600"
        >
          <ChevronLeft size={22} strokeWidth={2} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">สรุปให้หมอดู</h1>
      </header>

      {s.empty ? (
        <EmptyVisit />
      ) : (
        <>
          <div className="flex flex-col gap-1">
            <p className="text-xl font-semibold text-ink-900">
              {dash.ga ? `อายุครรภ์ ${dash.ga.weeks} สัปดาห์ ${dash.ga.days} วัน` : "สรุปสุขภาพ"}
            </p>
            <p className="text-[13px] text-ink-600">
              {s.since
                ? `ตั้งแต่พบแพทย์ครั้งที่แล้ว ${thaiDateFull(s.since)} · ${s.daysSince} วัน`
                : "ยังไม่เคยมีนัดที่ผ่านมา — สรุปข้อมูลทั้งหมดที่บันทึกไว้"}
            </p>
          </div>

          {/* ของผิดปกติอยู่บนสุดเสมอ */}
          {s.flags.length > 0 && (
            <section className="flex flex-col gap-2.5 rounded-md border border-cream-300 bg-[#FBF0EE] p-3.5">
              <h2 className="text-[13px] text-ink-600">สิ่งที่ควรบอกหมอ</h2>
              {s.flags.map((f) => (
                <p key={f.text} className="flex items-start gap-2">
                  <AlertCircle
                    size={16}
                    strokeWidth={2}
                    className={cn("mt-0.5 shrink-0", f.severity === "bad" ? "text-danger" : "text-warning")}
                  />
                  <span className="text-sm leading-relaxed text-ink-900">{f.text}</span>
                </p>
              ))}
            </section>
          )}

          <Block title="น้ำหนัก" icon={Scale}>
            <Stat label="ล่าสุด" value={s.weight.latest ? String(s.weight.latest.weight) : "—"}
              sub={s.weight.latest ? `กก. · ${short(s.weight.latest.date)}` : undefined} />
            <Stat label="จากครั้งที่แล้ว" value={signed(s.weight.sinceLast)} sub="กก."
              warn={s.weight.sinceLast != null && s.weight.sinceLast > 2} />
            <Stat label="รวมทั้งครรภ์" value={signed(s.weight.total)} sub="กก." />
          </Block>

          <Block title="ความดันโลหิต" icon={Activity}>
            <Stat
              label="ล่าสุด"
              value={s.bp.latest ? `${s.bp.latest.systolic}/${s.bp.latest.diastolic}` : "—"}
              sub={s.bp.latest ? short(s.bp.latest.date) : undefined}
              warn={s.bp.latest ? s.bp.latest.systolic >= 140 || s.bp.latest.diastolic >= 90 : false}
            />
            <Stat
              label="ก่อนหน้า"
              value={s.bp.previous ? `${s.bp.previous.systolic}/${s.bp.previous.diastolic}` : "—"}
              sub={s.bp.previous ? short(s.bp.previous.date) : undefined}
            />
            <Stat label="บันทึกไว้" value={String(s.bp.count)} sub="ครั้ง" />
          </Block>

          {s.kicks.count > 0 && (
            <Block title="ลูกดิ้น" icon={Footprints}>
              <Stat
                label="เฉลี่ยจนครบ"
                value={s.kicks.averageMs != null ? formatDuration(s.kicks.averageMs) : "—"}
              />
              <Stat
                label="ช้าที่สุด"
                value={s.kicks.slowest?.durationMs != null ? formatDuration(s.kicks.slowest.durationMs) : "—"}
                sub={s.kicks.slowest ? short(s.kicks.slowest.startedAt) : undefined}
              />
              <Stat label="นับไว้" value={String(s.kicks.count)} sub="รอบ" />
            </Block>
          )}

          {s.symptoms.length > 0 && (
            <section className="flex flex-col gap-2.5 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
              <h2 className="flex items-center gap-1.5 text-[13px] text-ink-600">
                <AlertCircle size={16} strokeWidth={1.9} className="text-ink-400" />
                อาการที่บันทึกไว้
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {s.symptoms.map((sym) => (
                  <span key={sym} className="rounded-full border border-cream-200 bg-cream-50 px-3 py-1 text-xs text-ink-600">
                    {sym}
                  </span>
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <Link
        href="/visit/questions"
        className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]"
      >
        <span className="flex items-center gap-2.5">
          <HelpCircle size={18} strokeWidth={1.9} className="text-peach-700" />
          <span className="flex flex-col">
            <span className="text-[15px] font-medium text-ink-900">คำถามที่อยากถาม</span>
            <span className="text-xs text-ink-400">
              {openQuestions > 0 ? `ยังไม่ได้ถาม ${openQuestions} ข้อ` : "จดไว้ตอนไหนก็ได้"}
            </span>
          </span>
        </span>
        <ChevronLeft size={18} strokeWidth={2} className="rotate-180 text-ink-400" />
      </Link>

      {/* ต้องอยู่ในหน้า ไม่ใช่ในเอกสารที่ไม่มีใครเปิด — หน้านี้ถูกยื่นให้หมอดู */}
      <p className="text-[11px] leading-relaxed text-ink-400">
        หน้านี้รวมสิ่งที่บันทึกไว้ในแอปเพื่อให้เล่าให้หมอฟังได้ครบ ไม่ใช่การวินิจฉัย
      </p>
    </div>
  );
}

function EmptyVisit() {
  return (
    <div className="flex flex-col items-center gap-3 px-3 pt-10 text-center">
      <span className="flex size-[88px] items-center justify-center rounded-full bg-cream-100">
        <Stethoscope size={38} strokeWidth={1.5} className="text-brown-300" />
      </span>
      <p className="text-[17px] font-semibold text-ink-900">ยังไม่มีข้อมูลให้สรุป</p>
      <p className="text-sm leading-relaxed text-ink-600">
        บันทึกน้ำหนักหรือความดันสักครั้ง แล้วหน้านี้จะสรุปให้เอง
      </p>
      <div className="pt-1">
        <ButtonLink href="/health/new" variant="secondary">
          บันทึกสุขภาพ
        </ButtonLink>
      </div>
    </div>
  );
}

function Block({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: typeof Scale;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2.5 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
      <h2 className="flex items-center gap-1.5 text-[13px] text-ink-600">
        <Icon size={16} strokeWidth={1.9} className="text-ink-400" />
        {title}
      </h2>
      <div className="flex gap-2">{children}</div>
    </section>
  );
}

/** ตัวเลขใหญ่กว่าที่อื่นในแอปโดยตั้งใจ — หมออ่านจากอีกฝั่งโต๊ะ */
function Stat({
  label,
  value,
  sub,
  warn = false,
}: {
  label: string;
  value: string;
  sub?: string;
  warn?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col gap-0.5">
      <span className="text-[13px] text-ink-600">{label}</span>
      <span className={cn("text-2xl font-semibold tabular-nums", warn ? "text-danger" : "text-ink-900")}>
        {value}
      </span>
      {sub && <span className="text-xs text-ink-400">{sub}</span>}
    </div>
  );
}

const short = (iso: string) => {
  const [, m, d] = iso.slice(0, 10).split("-").map(Number);
  const M = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");
  return `${d} ${M[m - 1]}`;
};

const signed = (n: number | null) => (n == null ? "—" : n > 0 ? `+${n}` : String(n));
