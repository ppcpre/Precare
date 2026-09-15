import Link from "next/link";
import { MapPin, User as UserIcon, Bell, BellOff, Pencil, Receipt, StickyNote } from "lucide-react";
import { formatBaht } from "@/lib/money";
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
  /**
   * ทางเข้าใบเสร็จอยู่บนการ์ดของนัดที่ถึงวันแล้ว
   *
   * เดิมมีทางเดียวคือกดไอคอนดินสอเล็กๆ เข้าหน้าแก้นัด แล้วเลื่อนผ่านฟอร์มทั้งหน้า
   * ผู้ใช้ทดสอบบน dev แล้วหาปุ่มแนบใบเสร็จไม่เจอเลย ทั้งที่ deploy ขึ้นไปแล้ว
   * ใบเสร็จเกิดหลังไปหาหมอ นัดที่ยังไม่ถึงวันจึงไม่ต้องมีปุ่มนี้ให้รก
   */
  const showReceipt = canEdit && days <= 0;
  return (
    <Card className="flex flex-col gap-3">
      {/* จางเฉพาะเนื้อหาของนัดที่ผ่านไปแล้ว ไม่จางปุ่ม — ปุ่มที่จางดูเหมือนกดไม่ได้ */}
      <div className={`flex items-start gap-3 ${past ? "opacity-60" : ""}`}>
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
              // 44px ตามเกณฑ์ของ design system — เดิม 32px ซึ่ง mobile-audit ไม่จับ
              // เพราะบัญชีที่ใช้ตรวจยังไม่มีนัดสักอัน การ์ดจึงไม่เคยถูกวาด
              className="-mr-2 -mt-1 flex size-11 items-center justify-center rounded-sm text-ink-400 hover:bg-cream-100 hover:text-ink-600"
            >
              <Pencil size={16} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>

      {showReceipt && (
        <Link
          href={`/appointments/${appt.id}/edit#receipts`}
          className="-mb-1 flex min-h-11 items-center justify-between gap-2 border-t border-cream-200 pt-2.5 text-[13px]"
        >
          <span className="flex items-center gap-1.5 font-medium text-brown-700">
            <Receipt size={16} strokeWidth={1.9} />
            {appt.costSatang == null ? "แนบใบเสร็จ / ค่าใช้จ่าย" : "ใบเสร็จ / ค่าใช้จ่าย"}
          </span>
          <span className="tabular-nums text-ink-600">
            {appt.costSatang == null ? "ยังไม่ระบุ" : `฿${formatBaht(appt.costSatang)}`}
          </span>
        </Link>
      )}
    </Card>
  );
}
