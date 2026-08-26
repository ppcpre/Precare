import Link from "next/link";
import { MapPin, User as UserIcon, Bell, BellOff, Pencil, StickyNote } from "lucide-react";
import { Card } from "@/components/ui/card";
import { TimeBadge } from "@/components/ui/badge";
import { DateBlock } from "@/components/dashboard/cards";
import { timeOf } from "@/lib/format";
import type { Appointment } from "@/types";

const REMIND_LABEL = (m: number) =>
  m >= 1440 ? `${m / 1440} วัน` : m >= 60 ? `${m / 60} ชั่วโมง` : `${m} นาที`;

export function AppointmentCard({
  appt,
  days,
  canEdit,
}: {
  appt: Appointment;
  days: number;
  canEdit: boolean;
}) {
  const past = days < 0;
  return (
    <Card className={past ? "opacity-60" : undefined}>
      <div className="flex items-start gap-3">
        <DateBlock iso={appt.apptDatetime} past={past} />

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <div className="flex flex-wrap items-center gap-x-2">
            <span className="font-semibold text-ink-900">{timeOf(appt.apptDatetime)}</span>
            {appt.title && (
              <>
                <span aria-hidden className="text-ink-400">·</span>
                <span className="font-medium text-ink-900">{appt.title}</span>
              </>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-ink-600">
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
          </div>

          <span className="flex items-center gap-1.5 text-xs text-ink-400">
            {appt.reminderEnabled ? (
              <>
                <Bell size={13} strokeWidth={1.9} />
                เตือนก่อน {REMIND_LABEL(appt.reminderMinutesBefore)}
              </>
            ) : (
              <>
                <BellOff size={13} strokeWidth={1.9} />
                ไม่เตือน
              </>
            )}
          </span>

          {appt.note && (
            <span className="flex items-start gap-1.5 text-[13px] leading-relaxed text-ink-600">
              <StickyNote size={14} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-400" />
              {appt.note}
            </span>
          )}
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          <TimeBadge days={days} />
          {canEdit && (
            <Link
              href={`/appointments/${appt.id}/edit`}
              aria-label="แก้ไขนัดหมาย"
              className="flex size-8 items-center justify-center rounded-sm text-ink-400 hover:bg-cream-100 hover:text-ink-600"
            >
              <Pencil size={16} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>
    </Card>
  );
}
