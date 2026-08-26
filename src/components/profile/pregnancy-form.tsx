"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { ChevronLeft, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Segmented } from "@/components/ui/segmented";
import { GestationProgress } from "@/components/ui/progress";
import { updatePregnancy } from "@/actions/pregnancy";
import { calculateDueDate, calculateGestationalAge, calculateLmpFromDueDate } from "@/lib/pregnancy";
import { thaiDate } from "@/lib/format";

const toIso = (d: Date) => d.toISOString().slice(0, 10);

export function PregnancyForm({
  currentLmp,
  currentDue,
  hasLogs,
}: {
  currentLmp: string | null;
  currentDue: string | null;
  hasLogs: boolean;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<"lmp" | "edd">("lmp");
  const [date, setDate] = useState(currentLmp ?? "");

  const { execute, isPending, result } = useAction(updatePregnancy, {
    onSuccess: () => {
      router.push("/dashboard");
      router.refresh();
    },
  });

  const lmp = date ? (mode === "lmp" ? date : toIso(calculateLmpFromDueDate(date))) : null;
  const due = date ? (mode === "lmp" ? toIso(calculateDueDate(date)) : date) : null;
  const ga = lmp ? calculateGestationalAge(lmp) : null;
  const changed = lmp !== currentLmp;

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="flex h-14 items-center gap-1 border-b border-cream-200 bg-white px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="ย้อนกลับ"
          className="flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <h1 className="font-semibold text-ink-900">วันตั้งครรภ์</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[520px] flex-1 flex-col gap-5 p-4">
        {currentLmp && currentDue && (
          <Card className="gap-2 bg-cream-100">
            <span className="text-sm text-ink-600">ค่าปัจจุบัน</span>
            <div className="flex justify-between text-sm">
              <span className="text-ink-600">วันประจำเดือนครั้งสุดท้าย</span>
              <span className="font-medium text-ink-900">{thaiDate(currentLmp)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-ink-600">วันคาดคลอด</span>
              <span className="font-medium text-ink-900">{thaiDate(currentDue)}</span>
            </div>
          </Card>
        )}

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">คุณทราบข้อมูลไหน</span>
          <Segmented
            label="เลือกข้อมูลที่ทราบ"
            value={mode}
            onChange={(m) => {
              setMode(m);
              setDate("");
            }}
            options={[
              { value: "lmp", label: "วันประจำเดือนครั้งสุดท้าย" },
              { value: "edd", label: "วันคาดคลอด" },
            ]}
          />
        </div>

        <Field
          label={mode === "lmp" ? "วันประจำเดือนครั้งสุดท้าย (LMP)" : "วันคาดคลอด (EDD)"}
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          max={mode === "lmp" ? new Date().toISOString().slice(0, 10) : undefined}
        />

        {ga && due && (
          <Card className="gap-3 rounded-lg border-peach-300 bg-peach-100 p-5">
            <span className="text-center text-sm text-ink-600">อายุครรภ์ที่จะเป็น</span>
            <div className="flex items-baseline justify-center gap-2">
              <span className="text-[40px] leading-none font-semibold text-peach-700">{ga.weeks}</span>
              <span className="flex flex-col">
                <span className="font-medium text-brown-900">สัปดาห์</span>
                <span className="text-sm text-ink-600">{ga.days} วัน</span>
              </span>
            </div>
            <GestationProgress week={ga.weeks} />
            <p className="text-center text-xs text-ink-600">คาดคลอด {thaiDate(due)}</p>
          </Card>
        )}

        {/* บันทึกเก่าเก็บ week ไว้ในแถวของมันเอง การแก้ LMP ไม่ย้อนไปแก้ให้ */}
        {changed && hasLogs && (
          <div className="flex items-start gap-2.5 rounded-md border border-warning bg-cream-100 p-3.5">
            <AlertCircle size={18} strokeWidth={1.9} className="mt-0.5 shrink-0 text-warning" />
            <p className="text-[13px] leading-relaxed text-ink-600">
              บันทึกสุขภาพที่มีอยู่แล้วเก็บเลขสัปดาห์ไว้ในตัวมันเอง
              <strong className="text-ink-900"> การแก้วันที่นี้จะไม่ย้อนไปแก้บันทึกเก่า</strong>
              — ถ้าต้องการให้ตรงกัน ต้องเข้าไปแก้ทีละรายการ
            </p>
          </div>
        )}

        {result.serverError && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            {result.serverError}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-cream-200 bg-white p-4">
        <div className="mx-auto max-w-[520px]">
          <Button
            full
            loading={isPending}
            disabled={!date || !changed}
            onClick={() =>
              execute(mode === "lmp" ? { lmpDate: date, dueDate: null } : { lmpDate: null, dueDate: date })
            }
          >
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}
