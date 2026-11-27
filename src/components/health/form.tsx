"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { X, Trash2, Camera, ChevronRight, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { ChipMultiSelect } from "@/components/ui/chip";
import { MoodPicker } from "@/components/ui/mood-picker";
import { BpInput } from "@/components/ui/bp-input";
import { createWeeklyLog, updateWeeklyLog, deleteWeeklyLog } from "@/actions/weekly-logs";
import Link from "next/link";
import type { Mood, WeeklyLogView } from "@/types";

/** ชุดอาการสำเร็จตาม screen-blueprint §6.3 */
const SYMPTOMS = [
  "คลื่นไส้", "อาเจียน", "ปวดหลัง", "บวม",
  "เหนื่อยง่าย", "นอนไม่หลับ", "ท้องผูก", "เวียนหัว",
] as const;

/** ยาวกว่านี้ไม่ใช่ "อาการ" แล้ว แต่เป็นบันทึก ซึ่งมีช่องของตัวเองอยู่ข้างล่าง */
const SYMPTOM_MAX = 40;

const numOrNull = (v: string) => (v.trim() === "" ? null : Number(v));

export function HealthForm({
  log,
  suggestedWeek,
  lastWeight,
  photoCount = 0,
  usedSymptoms = [],
}: {
  log?: WeeklyLogView;
  /** อาการที่ครอบครัวนี้เคยบันทึกเอง — กดเลือกซ้ำได้ ไม่ต้องพิมพ์ใหม่ */
  usedSymptoms?: string[];
  suggestedWeek: number | null;
  lastWeight: number | null;
  photoCount?: number;
}) {
  const router = useRouter();
  const editing = Boolean(log);

  const [logDate, setLogDate] = useState(log?.logDate ?? new Date().toISOString().slice(0, 10));
  const [week, setWeek] = useState(String(log?.week ?? suggestedWeek ?? ""));
  const [weight, setWeight] = useState(log?.weight != null ? String(log.weight) : "");
  const [sys, setSys] = useState(log?.bpSystolic != null ? String(log.bpSystolic) : "");
  const [dia, setDia] = useState(log?.bpDiastolic != null ? String(log.bpDiastolic) : "");
  const [symptoms, setSymptoms] = useState<string[]>(log?.symptoms ?? []);
  const [custom, setCustom] = useState("");

  /**
   * ชิปที่ให้เลือก = ชุดสำเร็จ + อาการที่เคยบันทึกเอง + ที่เลือกอยู่ตอนนี้
   *
   * รวมของที่เลือกอยู่ด้วย เพราะบันทึกเก่าที่กำลังแก้อาจมีอาการที่หลุดออกจาก
   * รายการ 12 ตัวล่าสุดไปแล้ว ถ้าไม่รวม ชิปนั้นจะหายไปทั้งที่ยังถูกเลือกอยู่
   */
  const options = useMemo(
    () => [...new Set([...SYMPTOMS, ...usedSymptoms, ...symptoms])],
    [usedSymptoms, symptoms],
  );

  const addCustom = () => {
    const v = custom.trim().slice(0, SYMPTOM_MAX);
    if (!v) return;
    // กดเพิ่มอาการที่มีอยู่แล้ว = เลือกอันนั้น ไม่ใช่สร้างซ้ำ
    setSymptoms((prev) => (prev.includes(v) ? prev : [...prev, v]));
    setCustom("");
  };
  const [mood, setMood] = useState<Mood | null>(log?.mood ?? null);
  const [note, setNote] = useState(log?.note ?? "");

  const [addPhotosAfter, setAddPhotosAfter] = useState(false);

  const done = () => {
    router.push("/health");
    router.refresh();
  };
  const create = useAction(createWeeklyLog, {
    onSuccess: ({ data }) => {
      // เพิ่งสร้างบันทึกใหม่ ยังไม่มี id ตอนอยู่ในฟอร์ม จึงพาไปเพิ่มรูปหลังบันทึกเสร็จ
      if (addPhotosAfter && data?.id) {
        router.push(`/album/upload?logId=${data.id}`);
        router.refresh();
        return;
      }
      done();
    },
  });
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
          <ChipMultiSelect options={options} value={symptoms} onChange={setSymptoms} />

          {/* พิมพ์เองได้ — ชุดสำเร็จครอบคลุมไม่หมด และอาการที่ไม่มีในรายการ
              คือสิ่งที่ควรบอกหมอที่สุด · พิมพ์ครั้งเดียว ครั้งหน้ากดเลือกได้เลย */}
          <div className="flex gap-2">
            <input
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  // อยู่ในฟอร์ม กด Enter แล้วจะกลายเป็นบันทึกทั้งฟอร์ม
                  e.preventDefault();
                  addCustom();
                }
              }}
              maxLength={SYMPTOM_MAX}
              aria-label="เพิ่มอาการเอง"
              placeholder="อาการอื่น เช่น ปวดท้องน้อย"
              className="h-11 min-w-0 flex-1 rounded-md border border-cream-200 bg-white px-3 text-sm text-ink-900 placeholder:text-ink-400"
            />
            <button
              type="button"
              onClick={addCustom}
              disabled={custom.trim() === ""}
              className="flex h-11 shrink-0 items-center gap-1.5 rounded-md border border-cream-200 bg-white px-3.5 text-sm font-medium text-ink-900 disabled:opacity-40"
            >
              <Plus size={16} strokeWidth={2} />
              เพิ่ม
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">อารมณ์วันนี้</span>
          <MoodPicker value={mood} onChange={setMood} />
        </div>

        {/* รูปผูกกับบันทึกนี้ และไปโผล่ในอัลบั้มด้วย */}
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">รูปภาพ</span>
          {log ? (
            <Link
              href={`/album/upload?logId=${log.id}`}
              className="flex items-center gap-3 rounded-md border border-cream-200 bg-white p-4"
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-sm bg-brown-100">
                <Camera size={20} strokeWidth={1.8} className="text-brown-700" />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-medium text-ink-900">เพิ่มรูปเข้าบันทึกนี้</span>
                <span className="text-[13px] text-ink-600">
                  {photoCount > 0 ? `มีอยู่แล้ว ${photoCount} รูป` : "อัลตราซาวด์ หรือความทรงจำของสัปดาห์นี้"}
                </span>
              </span>
              <ChevronRight size={16} strokeWidth={2} className="shrink-0 text-ink-400" />
            </Link>
          ) : (
            <label className="flex items-center gap-3 rounded-md border border-cream-200 bg-white p-4">
              <input
                type="checkbox"
                checked={addPhotosAfter}
                onChange={(e) => setAddPhotosAfter(e.target.checked)}
                className="size-5 min-h-0 shrink-0 accent-brown-700"
              />
              <span className="flex flex-col gap-0.5">
                <span className="text-ink-900">บันทึกแล้วเพิ่มรูปต่อ</span>
                <span className="text-[13px] text-ink-600">
                  รูปจะผูกกับบันทึกนี้และไปแสดงในอัลบั้มด้วย
                </span>
              </span>
            </label>
          )}
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
