"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Info, Minus, Plus } from "lucide-react";
import { addBabyLog } from "@/actions/baby-log";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { TimeField, atFromTime } from "./time-field";

/** B6 — ปั๊มนม · ข้อมูลของแม่ ไม่ผูกกับลูกคนไหน */
export function PumpForm({
  back,
  initialLeft,
  initialRight,
}: {
  back: string;
  initialLeft: number;
  initialRight: number;
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : "";
  const [left, setLeft] = useState(initialLeft);
  const [right, setRight] = useState(initialRight);
  const [time, setTime] = useState<string | null>(null);
  const [minutes, setMinutes] = useState("");
  const add = useAction(addBabyLog, {
    onSuccess: () => {
      router.push(back);
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-4 pb-28">
      <p className="flex items-start gap-2 rounded-md bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
        <Info size={15} className="mt-0.5 shrink-0 text-ink-400" />
        ปั๊มนมเป็นข้อมูลของแม่ ไม่ผูกกับลูกคนไหน
      </p>
      <Stepper label="ข้างซ้าย" value={left} onChange={setLeft} />
      <Stepper label="ข้างขวา" value={right} onChange={setRight} />
      <div className="flex items-center justify-between rounded-md border border-cream-200 bg-white px-3 py-3">
        <span className="text-sm text-ink-600">รวม</span>
        <span className="text-xl font-semibold tabular-nums text-ink-900">{left + right} มล.</span>
      </div>
      <TimeField value={time} onChange={setTime} nowIso={nowIso} />
      <label className="flex flex-col gap-1 text-sm text-ink-600">
        ใช้เวลา (ไม่บังคับ)
        <span className="flex items-center gap-2">
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={120}
            placeholder="เช่น 20"
            value={minutes}
            onChange={(e) => setMinutes(e.target.value)}
            className="h-11 flex-1 rounded-md border border-cream-300 px-3 text-base tabular-nums text-ink-900"
          />
          นาที
        </span>
      </label>
      {add.result.serverError && <p role="alert" className="text-[13px] text-danger">{add.result.serverError}</p>}
      <div className="fixed inset-x-0 bottom-16 border-t border-cream-200 bg-white p-4 md:bottom-0">
        <div className="mx-auto max-w-md">
          <Button
            full
            loading={add.isPending}
            disabled={left + right === 0}
            onClick={() =>
              add.execute({
                kind: "pump",
                at: time ? atFromTime(time, localIso()) : localIso(),
                leftMl: left,
                rightMl: right,
                minutes: Number(minutes) > 0 ? Math.min(120, Math.round(Number(minutes))) : null,
              })
            }
          >
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}

function Stepper({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-600">{label}</span>
      <div className="flex items-center justify-between rounded-md border border-cream-200 bg-white px-3 py-2">
        <button
          type="button"
          aria-label={`ลด${label} 10 มล.`}
          onClick={() => onChange(Math.max(0, value - 10))}
          className="flex size-12 items-center justify-center rounded-full border border-cream-300"
        >
          <Minus size={20} />
        </button>
        <span className="text-3xl font-semibold tabular-nums text-ink-900">
          {value} <span className="text-base font-normal text-ink-600">มล.</span>
        </span>
        <button
          type="button"
          aria-label={`เพิ่ม${label} 10 มล.`}
          onClick={() => onChange(Math.min(500, value + 10))}
          className="flex size-12 items-center justify-center rounded-full border border-cream-300"
        >
          <Plus size={20} />
        </button>
      </div>
    </div>
  );
}
