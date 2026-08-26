import Link from "next/link";
import { ChevronRight, MapPin, Scale, Activity, User as UserIcon } from "lucide-react";
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

export function NextAppointmentCard({ appt, now }: { appt: Appointment | null; now: number }) {
  if (!appt) {
    return (
      <Card className="flex items-center justify-between gap-3">
        <span className="text-sm text-ink-600">ยังไม่มีนัดหมาย</span>
        <Link href="/appointments/new" className="text-[13px] font-medium text-brown-700">
          เพิ่มนัดหมาย
        </Link>
      </Card>
    );
  }
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-600">นัดหมายถัดไป</span>
        <TimeBadge days={daysFromNow(appt.apptDatetime, now)} />
      </div>
      <Link href="/appointments" className="flex items-start gap-3">
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
    </Card>
  );
}

export function RecentLogsCard({ logs }: { logs: WeeklyLogView[] }) {
  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-600">บันทึกล่าสุด</span>
        <Link
          href="/health"
          className="flex items-center gap-0.5 text-[13px] font-medium text-brown-700"
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
