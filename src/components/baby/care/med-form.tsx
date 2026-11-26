"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Plus, X } from "lucide-react";
import { deleteChildMed, saveChildMed, setChildMedActive } from "@/actions/child-care";
import { MAX_MED_TIMES_CHILD, MED_GAPS, gapLabel, parseTimes } from "@/lib/child-meds";
import type { ChildMedView } from "@/lib/child-care-queries";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";

const TIME_INPUT =
  "h-11 min-w-0 flex-1 rounded-sm border border-cream-200 bg-cream-50 px-3 text-base text-ink-900 " +
  "focus:border-[1.5px] focus:border-brown-500 focus:outline-none";

/** เพิ่ม/แก้ยาของลูก — ช่วงห่างเป็นค่าที่ผู้ใช้ตั้งตามแพทย์หรือฉลาก แอปไม่แนะนำค่าเอง */
export function MedForm({ childId, med }: { childId: string; med: ChildMedView | null }) {
  const router = useRouter();
  const back = `/baby/${childId}/meds`;
  const [name, setName] = useState(med?.name ?? "");
  const [dose, setDose] = useState(med?.dose ?? "");
  const [mode, setMode] = useState<"prn" | "daily">(med?.mode ?? "prn");
  const [gap, setGap] = useState<number | null>(med?.minGapMin ?? null);
  const [times, setTimes] = useState<string[]>(med?.times ? parseTimes(med.times) : ["09:00"]);
  const [note, setNote] = useState(med?.note ?? "");

  const done = () => {
    router.push(back);
    router.refresh();
  };
  const save = useAction(saveChildMed, { onSuccess: done });
  const toggle = useAction(setChildMedActive, { onSuccess: done });
  const del = useAction(deleteChildMed, { onSuccess: done });

  const v = save.result.validationErrors as
    | { minGapMin?: { _errors?: string[] }; times?: { _errors?: string[] }; name?: { _errors?: string[] } }
    | undefined;
  const error = save.result.serverError ?? toggle.result.serverError ?? del.result.serverError;

  return (
    <div className="flex flex-col gap-[18px] pb-8">
      <header className="flex items-center justify-between">
        <Link
          href={back}
          aria-label="ปิด"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <X size={22} />
        </Link>
        <h1 className="text-lg font-semibold text-ink-900">{med ? "แก้ยาของลูก" : "เพิ่มยาของลูก"}</h1>
        <button
          type="button"
          disabled={save.isPending || !name.trim()}
          onClick={() =>
            save.execute({
              id: med?.id,
              childId,
              name,
              dose: dose.trim() || null,
              mode,
              minGapMin: mode === "prn" ? gap : null,
              times: mode === "daily" ? times : [],
              note: note.trim() || null,
            })
          }
          className="-mr-2 h-11 px-2 text-[15px] font-semibold text-brown-700 disabled:opacity-50"
        >
          บันทึก
        </button>
      </header>

      <Field
        label="ชื่อยา"
        placeholder="เช่น ยาลดไข้ (น้ำ)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={80}
        error={v?.name?._errors?.[0]}
      />
      <Field
        label="ครั้งละ"
        placeholder="เช่น 1.2 มล."
        hint="ตามที่แพทย์หรือฉลากยาบอก"
        value={dose}
        onChange={(e) => setDose(e.target.value)}
        maxLength={40}
      />

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-600">ให้แบบไหน</span>
        <Segmented
          label="ให้แบบไหน"
          value={mode}
          onChange={setMode}
          options={[
            { value: "prn", label: "ตามอาการ" },
            { value: "daily", label: "ทุกวัน" },
          ]}
        />
      </div>

      {mode === "prn" ? (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-600">ห่างกันอย่างน้อย</span>
          <div role="radiogroup" aria-label="ห่างกันอย่างน้อย" className="flex gap-1.5">
            {MED_GAPS.map((m) => (
              <button
                key={m}
                type="button"
                role="radio"
                aria-checked={gap === m}
                onClick={() => setGap(m)}
                className={`h-11 flex-1 rounded-sm border text-sm ${
                  gap === m ? "border-brown-700 bg-brown-100 font-medium text-ink-900" : "border-cream-200 bg-white text-ink-600"
                }`}
              >
                {gapLabel(m)}
              </button>
            ))}
          </div>
          <p className={`text-xs ${v?.minGapMin ? "text-danger" : "text-ink-400"}`}>
            {v?.minGapMin?._errors?.[0] ??
              "ตามที่แพทย์หรือฉลากบอก ใช้บอกคนในบ้านว่าเพิ่งให้ไป ไม่ได้ห้ามบันทึก"}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          <span className="text-sm text-ink-600">เวลาที่ให้</span>
          {times.map((t, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                type="time"
                aria-label={`เวลาที่ ${i + 1}`}
                value={t}
                onChange={(e) => setTimes((arr) => arr.map((x, j) => (j === i ? e.target.value : x)))}
                className={TIME_INPUT}
              />
              {times.length > 1 && (
                <button
                  type="button"
                  aria-label={`ลบเวลาที่ ${i + 1}`}
                  onClick={() => setTimes((arr) => arr.filter((_, j) => j !== i))}
                  className="flex size-11 items-center justify-center rounded-full text-ink-400 hover:bg-cream-100"
                >
                  <X size={18} />
                </button>
              )}
            </div>
          ))}
          {times.length < MAX_MED_TIMES_CHILD && (
            <button
              type="button"
              onClick={() => setTimes((arr) => [...arr, "21:00"])}
              className="flex min-h-11 items-center gap-1.5 self-start text-sm text-brown-700"
            >
              <Plus size={16} strokeWidth={2} />
              เพิ่มเวลา
            </button>
          )}
          {v?.times?._errors?.[0] && <p className="text-xs text-danger">{v.times._errors[0]}</p>}
        </div>
      )}

      <Field label="หมายเหตุ" placeholder="ไม่บังคับ" value={note} onChange={(e) => setNote(e.target.value)} maxLength={300} />

      {error && (
        <p role="alert" className="text-[13px] text-danger">
          {error}
        </p>
      )}

      {med && (
        <div className="flex flex-col gap-1">
          <Button
            variant="secondary"
            loading={toggle.isPending}
            onClick={() => toggle.execute({ medId: med.id, active: !med.active })}
          >
            {med.active ? "หยุดให้ยานี้ (เก็บประวัติไว้)" : "กลับมาให้ยานี้อีก"}
          </Button>
          <Button
            variant="ghost"
            className="text-danger"
            loading={del.isPending}
            onClick={() => {
              if (confirm(`ลบ${med.name} พร้อมประวัติการให้ยาทั้งหมด? ย้อนกลับไม่ได้`)) del.execute({ medId: med.id });
            }}
          >
            ลบยานี้และประวัติ
          </Button>
        </div>
      )}
    </div>
  );
}
