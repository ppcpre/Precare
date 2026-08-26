"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { X, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ChipMultiSelect } from "@/components/ui/chip";
import { MoodPicker } from "@/components/ui/mood-picker";
import { BpInput } from "@/components/ui/bp-input";
import { createWeeklyLog, updateWeeklyLog, deleteWeeklyLog } from "@/actions/weekly-logs";
import type { Mood, WeeklyLogView } from "@/types";

/** ชุดอาการสำเร็จตาม screen-blueprint §6.3 */
const SYMPTOMS = [
  "คลื่นไส้", "อาเจียน", "ปวดหลัง", "บวม",
  "เหนื่อยง่าย", "นอนไม่หลับ", "ท้องผูก", "เวียนหัว",
] as const;

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function HealthForm({
  log,
  suggestedWeek,
  lastWeight,
}: {
  log?: WeeklyLogView;
  suggestedWeek: number | null;
  lastWeight: number | null;
}) {
  const router = useRouter();
  const editing = Boolean(log);

  const [logDate, setLogDate] = useState(log?.logDate ?? new Date().toISOString().slice(0, 10));
  const [week, setWeek] = useState(String(log?.week ?? suggestedWeek ?? ""));
  const [weight, setWeight] = useState(log?.weight != null ? String(log.weight) : "");
  const [sys, setSys] = useState(log?.bpSystolic != null ? String(log.bpSystolic) : "");
  const [dia, setDia] = useState(log?.bpDiastolic != null ? String(log.bpDiastolic) : "");
  const [symptoms, setSymptoms] = useState<string[]>(log?.symptoms ?? []);
  const [mood, setMood] = useState<Mood | null>(log?.mood ?? null);
  const [note, setNote] = useState(log?.note ?? "");

  const done = () => {
    router.push("/health");
    router.refresh();
  };
  const create = useAction(createWeeklyLog, { onSuccess: done });
  const update = useAction(updateWeeklyLog, { onSuccess: done });
  const remove = useAction(deleteWeeklyLog, { onSuccess: done });

  const pending = create.isPending || update.isPending || remove.isPending;
  const error = create.result.serverError ?? update.result.serverError ?? remove.result.serverError;

  const delta =
    lastWeight != null && weight.trim() !== "" && !editing
      ? Number(weight) - lastWeight
      : null;

  const submit = () => {
    const payload = {
      logDate,
      week: Number(week),
      weight: numOrNull(weight),
      bpSystolic: numOrNull(sys),
      bpDiastolic: numOrNull(dia),
      symptoms,
      mood,
      note: note.trim() || null,
    };
    if (log) update.execute({ ...payload, id: log.id });
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
        <h1 className="font-semibold text-ink-900">
          {editing ? "แก้ไขบันทึกสุขภาพ" : "บันทึกสุขภาพ"}
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 p-4">
        {error && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            {error}
          </p>
        )}

        <Field
          label="วันที่บันทึก"
          type="date"
          value={logDate}
          onChange={(e) => setLogDate(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
        />
        <Field
          label="สัปดาห์ที่"
          inputMode="numeric"
          value={week}
          onChange={(e) => setWeek(e.target.value.replace(/\D/g, "").slice(0, 2))}
          hint="คำนวณจากวันที่ตั้งครรภ์ แก้ไขได้"
        />
        <Field
          label="น้ำหนัก"
          inputMode="decimal"
          suffix="กก."
          value={weight}
          onChange={(e) => setWeight(e.target.value.replace(/[^\d.]/g, "").slice(0, 5))}
          hint={
            delta != null && delta !== 0
              ? `${delta > 0 ? "+" : ""}${delta.toFixed(1)} จากครั้งที่แล้ว`
              : undefined
          }
        />

        <BpInput
          systolic={sys}
          diastolic={dia}
          onChange={(s, d) => {
            setSys(s);
            setDia(d);
          }}
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">อาการ</span>
          <ChipMultiSelect options={SYMPTOMS} value={symptoms} onChange={setSymptoms} />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">อารมณ์วันนี้</span>
          <MoodPicker value={mood} onChange={setMood} />
        </div>

        <Textarea
          label="บันทึกเพิ่มเติม"
          rows={3}
          placeholder="อาการ ความรู้สึก หรือสิ่งที่อยากบอกคุณหมอ"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={2000}
        />

        {log && (
          <Button
            variant="ghost"
            className="text-danger hover:bg-cream-100"
            loading={remove.isPending}
            onClick={() => {
              if (confirm("ลบบันทึกนี้? การลบย้อนกลับไม่ได้")) remove.execute({ id: log.id });
            }}
          >
            <Trash2 size={18} strokeWidth={1.8} />
            ลบบันทึกนี้
          </Button>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-cream-200 bg-white p-4">
        <div className="mx-auto max-w-[560px]">
          <Button full loading={pending} disabled={!week} onClick={submit}>
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}
