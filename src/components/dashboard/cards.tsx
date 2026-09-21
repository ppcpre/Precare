import Link from "next/link";
import { ChevronRight, MapPin, Scale, Activity, Stethoscope, User as UserIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TimeBadge, daysFromNow } from "@/components/ui/badge";
import { MoodFace } from "@/components/mood";
import { dayOf, dayMonth, isHighBp, monthShort, timeOf } from "@/lib/format";
import type { Appointment, WeeklyLogView } from "@/types";

/** บล็อกวันที่ซ้ายการ์ดนัดหมาย */
export function DateBlock({ iso, past }: { iso: string; past?: boolean }) {
  return (
    <span
      className={`flex h-[52px] w-[46px] shrink-0 flex-col items-center justify-center gap-px rounded-sm ${
        past ? "bg-cream-200" : "bg-brown-100"
      }`}
    >
      <span className={`text-[11px] ${past ? "text-ink-400" : "text-brown-700"}`}>
        {monthShort(iso)}
      </span>
      <span
        className={`text-xl leading-none font-semibold ${past ? "text-ink-400" : "text-brown-900"}`}
      >
        {dayOf(iso)}
      </span>
    </span>
  );
}

export function NextAppointmentCard({
  appt,
  now,
  openQuestions = 0,
}: {
  appt: Appointment | null;
  now: number;
  /** จำนวนคำถามที่จดไว้แต่ยังไม่ได้ถาม — โชว์บนทางเข้าหน้าสรุป */
  openQuestions?: number;
}) {
  return (
    <Card className="flex flex-col gap-3">
      {appt ? (
        <>
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600">นัดหมายถัดไป</span>
            <TimeBadge days={daysFromNow(appt.apptDatetime, now)} />
          </div>
          <Link href="/appointments" prefetch={false} className="flex items-start gap-3">
            <DateBlock iso={appt.apptDatetime} />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="font-medium text-ink-900">
                {timeOf(appt.apptDatetime)}
                {appt.title ? ` · ${appt.title}` : ""}
              </span>
              <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-600">
                {appt.doctorName && (
                  <span className="flex items-center gap-1">
                    <UserIcon size={14} strokeWidth={1.9} className="text-ink-400" />
                    {appt.doctorName}
                  </span>
                )}
                {appt.location && (
                  <span className="flex items-center gap-1">
                    <MapPin size={14} strokeWidth={1.9} className="text-ink-400" />
                    {appt.location}
                  </span>
                )}
              </span>
            </span>
          </Link>
        </>
      ) : (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-ink-600">ยังไม่มีนัดหมาย</span>
          <Link
            href="/appointments/new"
            className="-my-3 flex min-h-11 items-center py-3 text-[13px] font-medium text-brown-700"
          >
            เพิ่มนัดหมาย
          </Link>
        </div>
      )}

      {/* ทางเข้าอยู่ตรงนี้เพราะเป็นจังหวะที่คนกำลังคิดถึงการไปหาหมอพอดี
          วางในเมนูหลักจะไม่มีใครกด เพราะเป็นของที่นึกถึงเฉพาะตอนจะไปตรวจ

          ต้องอยู่ทั้งสองกรณี — ตอนแรกใส่ไว้เฉพาะกรณีมีนัด ผลคือคนที่ยังไม่ได้
          ลงนัดเข้าหน้าสรุปไม่ได้เลย ทั้งที่เป็นกลุ่มที่ควรได้จดคำถามไว้ล่วงหน้ามากที่สุด
          (เทสต์จับได้ตอนรันจริง)

          บีบเหลือบรรทัดเดียว: ตัดคำอธิบายกับเส้นคั่นออก เหลือไอคอนเล็กกับชื่อ
          สูงจาก 2 บรรทัด + เส้นคั่น เหลือแถวเดียว — คงข้อความไว้เพราะไอคอนล้วน
          หาไม่เจอ (บทเรียนจากไอคอนดินสอบนการ์ดนัด) จำนวนคำถามที่ค้างย้ายมาเป็น
          ตัวเลขท้ายชื่อแทนบรรทัดที่สอง */}
      <Link
        href="/visit"
        prefetch={false}
        className="-mb-1 -mt-0.5 flex min-h-11 items-center gap-2 text-[13px] font-medium text-brown-700"
      >
        <Stethoscope size={16} strokeWidth={1.9} />
        สรุปให้หมอดู
        {openQuestions > 0 && (
          <span className="rounded-full bg-cream-100 px-1.5 py-px text-[11px] tabular-nums text-ink-600">
            {openQuestions}
          </span>
        )}
        <ChevronRight size={14} strokeWidth={2} className="text-ink-400" />
      </Link>
    </Card>
  );
}

export function RecentLogsCard({ logs }: { logs: WeeklyLogView[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-600">บันทึกล่าสุด</span>
        <Link
          prefetch={false}
          href="/health"
          className="-my-3 flex min-h-11 items-center gap-0.5 py-3 text-[13px] font-medium text-brown-700"
        >
          ดูทั้งหมด
          <ChevronRight size={14} strokeWidth={2} />
        </Link>
      </div>

      {logs.length === 0 ? (
        <p className="py-2 text-sm text-ink-400">ยังไม่มีบันทึกสุขภาพ</p>
      ) : (
        <ul className="flex flex-col">
          {logs.map((l, i) => {
            const high = isHighBp(l.bpSystolic, l.bpDiastolic);
            return (
              <li
                key={l.id}
                className={`flex items-center justify-between gap-3 py-2.5 ${i > 0 ? "border-t border-cream-200" : ""}`}
              >
                <span className="flex min-w-0 flex-col gap-1">
                  <span className="font-medium text-ink-900">สัปดาห์ที่ {l.week}</span>
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px]">
                    {l.weight != null && (
                      <span className="flex items-center gap-1 text-ink-600">
                        <Scale size={14} strokeWidth={1.9} className="text-ink-400" />
                        {l.weight} กก.
                      </span>
                    )}
                    {l.bpSystolic != null && l.bpDiastolic != null && (
                      <span className={`flex items-center gap-1 ${high ? "font-medium text-danger" : "text-ink-600"}`}>
                        <Activity
                          size={14}
                          strokeWidth={1.9}
                          className={high ? "text-danger" : "text-ink-400"}
                        />
                        {l.bpSystolic}/{l.bpDiastolic}
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col items-center gap-1">
                  {l.mood && <MoodFace mood={l.mood} size={24} className="text-ink-400" />}
                  <span className="text-[11px] text-ink-400">{dayMonth(l.logDate)}</span>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
