"use client";

import { useState } from "react";
import { useAction } from "next-safe-action/hooks";
import { ChevronLeft, Baby } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Segmented, ProgressDots } from "@/components/ui/segmented";
import { GestationProgress } from "@/components/ui/progress";
import { completeOnboarding } from "@/actions/onboarding";
import { calculateDueDate, calculateGestationalAge, calculateLmpFromDueDate } from "@/lib/pregnancy";

const TOTAL = 4;
const THAI_MONTHS = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");

/** 15 ธ.ค. 2569 — พ.ศ. ตามที่คนไทยอ่าน */
function thaiDate(iso: string) {
  const d = new Date(iso);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${d.getFullYear() + 543}`;
}
const toIso = (d: Date) => d.toISOString().slice(0, 10);
const todayIso = () => new Date().toISOString().slice(0, 10);

export function OnboardingWizard({ defaultFamilyName }: { defaultFamilyName: string }) {
  const [step, setStep] = useState(0);
  const [familyName, setFamilyName] = useState(defaultFamilyName);
  const [mode, setMode] = useState<"lmp" | "edd">("lmp");
  const [date, setDate] = useState("");

  const { execute, isPending, result } = useAction(completeOnboarding);

  // คำนวณสดจากวันที่ที่กรอก — กรอก LMP ได้ EDD / กรอก EDD ได้ LMP
  const lmp = date ? (mode === "lmp" ? date : toIso(calculateLmpFromDueDate(date))) : null;
  const due = date ? (mode === "lmp" ? toIso(calculateDueDate(date)) : date) : null;
  const ga = lmp ? calculateGestationalAge(lmp) : null;
  const dateValid = Boolean(date) && (!ga || (ga.weeks >= 0 && ga.weeks <= 44));

  const submit = (skipDate: boolean) =>
    execute({
      familyName: familyName.trim(),
      ...(skipDate || !date ? {} : mode === "lmp" ? { lmpDate: date } : { dueDate: date }),
    });

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="flex h-14 shrink-0 items-center px-4">
        {step > 0 && (
          <button
            type="button"
            onClick={() => setStep((s) => s - 1)}
            aria-label="ย้อนกลับ"
            className="flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
          >
            <ChevronLeft size={22} strokeWidth={1.8} />
          </button>
        )}
      </header>

      <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col gap-7 px-6 pb-6">
        <ProgressDots step={step} total={TOTAL} />

        {step === 0 && (
          <div className="flex flex-1 flex-col justify-center gap-6 text-center">
            <div className="mx-auto flex size-24 items-center justify-center rounded-full bg-peach-100">
              <Baby size={44} strokeWidth={1.6} className="text-peach-700" />
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-ink-900">เริ่มต้นดูแลการตั้งครรภ์ไปด้วยกัน</h1>
              <p className="text-sm leading-relaxed text-ink-600">
                Pre Care ช่วยติดตามอายุครรภ์ บันทึกสุขภาพ และเตือนนัดหมาย
                โดยให้คนในครอบครัวเข้ามาดูด้วยกันได้
              </p>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-ink-900">ตั้งชื่อครอบครัว</h1>
              <p className="text-sm text-ink-600">ใช้แสดงบนหน้าแรกและตอนเชิญสมาชิก</p>
            </div>
            <Field
              label="ชื่อครอบครัว"
              value={familyName}
              onChange={(e) => setFamilyName(e.target.value)}
              maxLength={80}
              autoFocus
            />
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-ink-900">วันที่ตั้งครรภ์</h1>
              <p className="text-sm leading-relaxed text-ink-600">
                ใช้คำนวณอายุครรภ์และวันคาดคลอด แก้ไขภายหลังได้
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-sm text-ink-600">คุณทราบข้อมูลไหน</span>
              <Segmented
                label="เลือกข้อมูลที่ทราบ"
                value={mode}
                onChange={setMode}
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
              max={mode === "lmp" ? todayIso() : undefined}
              hint={
                mode === "lmp"
                  ? "นับจากวันแรกของประจำเดือนครั้งล่าสุด"
                  : "วันที่คุณหมอแจ้งไว้"
              }
              error={date && !dateValid ? "วันที่อยู่นอกช่วงที่เป็นไปได้" : undefined}
            />

            {ga && due && dateValid && (
              <Card className="flex flex-col gap-3 border-peach-300 bg-peach-100">
                <span className="text-sm text-ink-600">จากวันที่นี้ ระบบคำนวณได้</span>
                <div className="flex items-end justify-between">
                  <div className="flex flex-col gap-0.5">
                    <span className="text-xs text-ink-600">อายุครรภ์</span>
                    <span className="font-semibold text-ink-900">
                      {ga.weeks} สัปดาห์ {ga.days} วัน
                    </span>
                  </div>
                  <div className="flex flex-col gap-0.5 text-right">
                    <span className="text-xs text-ink-600">วันคาดคลอด</span>
                    <span className="font-semibold text-ink-900">{thaiDate(due)}</span>
                  </div>
                </div>
              </Card>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-1 flex-col gap-6">
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl font-semibold text-ink-900">เรียบร้อย</h1>
              <p className="text-sm text-ink-600">ตรวจสอบข้อมูลอีกครั้งก่อนเริ่มใช้งาน</p>
            </div>

            {ga && due ? (
              <Card className="flex flex-col gap-4 rounded-lg border-peach-300 bg-peach-100 p-5">
                <div className="flex flex-col items-center gap-1">
                  <span className="text-sm text-ink-600">อายุครรภ์ปัจจุบัน</span>
                  <div className="flex items-baseline gap-2">
                    <span className="text-[44px] leading-none font-semibold text-peach-700">
                      {ga.weeks}
                    </span>
                    <div className="flex flex-col">
                      <span className="font-medium text-ink-900">สัปดาห์</span>
                      <span className="text-sm text-ink-600">{ga.days} วัน</span>
                    </div>
                  </div>
                </div>
                <GestationProgress week={ga.weeks} />
                <div className="flex justify-between text-xs text-ink-400">
                  <span>สัปดาห์ 1</span>
                  <span>40 สัปดาห์</span>
                </div>
              </Card>
            ) : (
              <Card className="bg-cream-100 text-sm leading-relaxed text-ink-600">
                ยังไม่ได้ระบุวันที่ตั้งครรภ์ — ตั้งค่าภายหลังได้ที่หน้าโปรไฟล์
              </Card>
            )}

            <Card className="flex flex-col gap-3">
              <Row label="ชื่อครอบครัว" value={familyName} />
              {lmp && <Row label="วันประจำเดือนครั้งสุดท้าย" value={thaiDate(lmp)} />}
              {due && <Row label="วันคาดคลอด" value={thaiDate(due)} />}
            </Card>

            {result.serverError && (
              <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
                {result.serverError}
              </p>
            )}
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[400px] shrink-0 flex-col gap-3 px-6 pb-8">
        {step < TOTAL - 1 ? (
          <Button
            full
            disabled={(step === 1 && !familyName.trim()) || (step === 2 && Boolean(date) && !dateValid)}
            onClick={() => setStep((s) => s + 1)}
          >
            {step === 0 ? "เริ่มเลย" : "ถัดไป"}
          </Button>
        ) : (
          <Button full loading={isPending} onClick={() => submit(false)}>
            เริ่มใช้ Pre Care
          </Button>
        )}

        {step === 2 && !date && (
          <button
            type="button"
            onClick={() => setStep(3)}
            className="min-h-0 text-xs text-ink-400 hover:text-ink-600"
          >
            ยังไม่ทราบ ข้ามไปก่อน
          </button>
        )}
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-ink-600">{label}</span>
      <span className="text-sm font-medium text-ink-900">{value}</span>
    </div>
  );
}
