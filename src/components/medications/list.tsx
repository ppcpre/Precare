"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Check, Pill } from "lucide-react";
import { setDoseTaken } from "@/actions/medications";
import { cn } from "@/lib/cn";

export interface DoseRow {
  medId: string;
  name: string;
  dose: string | null;
  note: string | null;
  timeId: string;
  at: string;
  takenAt: string | null;
}

/**
 * รายการยาของวันนี้ — หนึ่งแถวต่อ "ยา × เวลา" ไม่ใช่ต่อยา
 *
 * ยาเม็ดเดียวที่กินสามเวลาคือสามแถว เพราะแต่ละครั้งต้องติ๊กแยกกัน
 * ถ้ารวมเป็นแถวเดียวจะตอบไม่ได้ว่ามื้อเที่ยงกินไปหรือยัง
 */
export function MedicationList({
  doses,
  dueOn,
  nowHm,
  canWrite,
}: {
  doses: DoseRow[];
  dueOn: string;
  /** เวลาตอนนี้ HH:MM ตามเวลาไทย — คำนวณฝั่ง server ไม่เรียก Date ใน render */
  nowHm: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const act = useAction(setDoseTaken, { onSuccess: () => router.refresh() });

  return (
    <ul className="flex flex-col gap-1.5">
      {doses.map((d) => {
        const taken = Boolean(d.takenAt);
        // เลยเวลาแล้วแต่ยังไม่ติ๊ก — เตือนด้วยสี ไม่ใช่ด้วยข้อความยาว
        const late = !taken && d.at < nowHm;
        return (
          <li
            key={d.timeId}
            className={cn(
              "flex items-center gap-2.5 rounded-sm px-3 py-2",
              taken ? "bg-sage-100" : late ? "bg-peach-100" : "bg-cream-50",
            )}
          >
            <span
              className={cn(
                "w-12 shrink-0 text-[13px] tabular-nums",
                late ? "font-medium text-peach-700" : "text-ink-600",
              )}
            >
              {d.at}
            </span>

            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
              <span className="flex items-center gap-1.5">
                <Pill size={14} strokeWidth={1.9} className="shrink-0 text-ink-400" />
                <span className={cn("truncate text-[13px]", taken && "text-ink-600 line-through")}>
                  {d.name}
                </span>
                {d.dose && <span className="shrink-0 text-[11px] text-ink-400">{d.dose}</span>}
              </span>
              {d.note && <span className="truncate text-[11px] text-ink-400">{d.note}</span>}
            </span>

            {canWrite && (
              <button
                type="button"
                disabled={act.isPending}
                aria-label={taken ? `ยกเลิกว่ากิน ${d.name} ${d.at}` : `กิน ${d.name} ${d.at} แล้ว`}
                aria-pressed={taken}
                onClick={() => act.execute({ timeId: d.timeId, dueOn, taken: !taken })}
                className={cn(
                  "flex size-11 shrink-0 items-center justify-center rounded-full disabled:opacity-40",
                  taken
                    ? "bg-sage-500 text-white"
                    : "border border-cream-200 bg-white text-ink-400",
                )}
              >
                <Check size={18} strokeWidth={2.4} />
              </button>
            )}
          </li>
        );
      })}
    </ul>
  );
}
