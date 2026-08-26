"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { createAppointment, updateAppointment, deleteAppointment } from "@/actions/appointments";
import type { Appointment } from "@/types";

const TITLE_SUGGESTIONS = ["ตรวจครรภ์ตามนัด", "อัลตราซาวด์", "ตรวจเลือด", "ฉีดวัคซีน"] as const;
const REMINDERS = [
  { m: 30, label: "30 นาที" },
  { m: 60, label: "1 ชม." },
  { m: 180, label: "3 ชม." },
  { m: 1440, label: "1 วัน" },
  { m: 2880, label: "2 วัน" },
] as const;

/** แยก ISO datetime เป็นวันที่กับเวลาสำหรับ input — เก็บกลับเป็น ISO ตอน submit */
const splitIso = (iso?: string) => {
  if (!iso) return { d: "", t: "" };
  const dt = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return {
    d: `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`,
    t: `${p(dt.getHours())}:${p(dt.getMinutes())}`,
  };
};

export function AppointmentForm({ appt }: { appt?: Appointment }) {
  const router = useRouter();
  const init = splitIso(appt?.apptDatetime);

  const [date, setDate] = useState(init.d);
  const [time, setTime] = useState(init.t);
  const [title, setTitle] = useState(appt?.title ?? "");
  const [doctor, setDoctor] = useState(appt?.doctorName ?? "");
  const [location, setLocation] = useState(appt?.location ?? "");
  const [remind, setRemind] = useState(appt?.reminderEnabled ?? true);
  const [minutes, setMinutes] = useState(appt?.reminderMinutesBefore ?? 60);
  const [note, setNote] = useState(appt?.note ?? "");

  const done = () => {
    router.push("/appointments");
    router.refresh();
  };
  const create = useAction(createAppointment, { onSuccess: done });
  const update = useAction(updateAppointment, { onSuccess: done });
  const remove = useAction(deleteAppointment, { onSuccess: done });

  const pending = create.isPending || update.isPending || remove.isPending;
  const error = create.result.serverError ?? update.result.serverError ?? remove.result.serverError;

  const submit = () => {
    const payload = {
      // เก็บเป็นเวลาท้องถิ่นแบบไม่มี timezone — นัดหมายผูกกับเวลาที่โรงพยาบาล
      apptDatetime: `${date}T${time}:00`,
      title: title.trim() || null,
      doctorName: doctor.trim() || null,
      location: location.trim() || null,
      note: note.trim() || null,
      reminderEnabled: remind,
      reminderMinutesBefore: minutes,
    };
    if (appt) update.execute({ ...payload, id: appt.id });
    else create.execute(payload);
  };

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="sticky top-0 z-10 flex h-14 items-center gap-3 border-b border-cream-200 bg-white px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="ปิด"
          className="flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <X size={22} strokeWidth={1.8} />
        </button>
        <h1 className="font-semibold text-ink-900">{appt ? "แก้ไขนัดหมาย" : "เพิ่มนัดหมาย"}</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 p-4">
        {error && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <div className="flex-1">
            <Field
              label="วันที่"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={appt ? undefined : new Date().toISOString().slice(0, 10)}
            />
          </div>
          <div className="flex-1">
            <Field
              label="เวลา"
              type="time"
              step={900}
              value={time}
              onChange={(e) => setTime(e.target.value)}
            />
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <Field
            label="หัวข้อนัด"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
          />
          <div className="flex flex-wrap gap-1.5">
            {TITLE_SUGGESTIONS.map((t) => (
              <Chip key={t} active={title === t} onClick={() => setTitle(t)}>
                {t}
              </Chip>
            ))}
          </div>
        </div>

        <Field
          label="แพทย์"
          placeholder="นพ./พญ. ..."
          value={doctor}
          onChange={(e) => setDoctor(e.target.value)}
          maxLength={120}
        />
        <Field
          label="สถานที่"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          maxLength={200}
        />

        <div className="flex flex-col gap-3.5 rounded-md border border-cream-200 bg-white p-4 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex flex-col">
              <span className="font-medium text-ink-900">การแจ้งเตือน</span>
              <span className="text-[13px] text-ink-600">เตือนก่อนถึงเวลานัด</span>
            </span>
            <button
              type="button"
              role="switch"
              aria-checked={remind}
              aria-label="เปิดการแจ้งเตือน"
              onClick={() => setRemind((v) => !v)}
              className={`flex h-7 w-12 min-h-0 shrink-0 items-center rounded-full p-[3px] transition-colors ${
                remind ? "justify-end bg-brown-700" : "justify-start bg-cream-200"
              }`}
            >
              <span className="size-[22px] rounded-full bg-white" />
            </button>
          </div>

          {remind && (
            <>
              <span className="h-px bg-cream-200" />
              <div className="flex flex-col gap-2">
                <span className="text-sm text-ink-600">เตือนล่วงหน้า</span>
                <div className="flex flex-wrap gap-1.5">
                  {REMINDERS.map((r) => (
                    <Chip key={r.m} active={minutes === r.m} onClick={() => setMinutes(r.m)}>
                      {r.label}
                    </Chip>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        <Textarea
          label="บันทึก"
          rows={3}
          placeholder="สิ่งที่ต้องเตรียม หรือคำถามที่อยากถามคุณหมอ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
        />

        {appt && (
          <Button
            variant="ghost"
            className="text-danger hover:bg-cream-100"
            loading={remove.isPending}
            onClick={() => {
              if (confirm("ลบนัดหมายนี้? การลบย้อนกลับไม่ได้")) remove.execute({ id: appt.id });
            }}
          >
            <Trash2 size={18} strokeWidth={1.8} />
            ลบนัดหมายนี้
          </Button>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-cream-200 bg-white p-4">
        <div className="mx-auto max-w-[560px]">
          <Button full loading={pending} disabled={!date || !time} onClick={submit}>
            บันทึกนัดหมาย
          </Button>
        </div>
      </div>
    </div>
  );
}
