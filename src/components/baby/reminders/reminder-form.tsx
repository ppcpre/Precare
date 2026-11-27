"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { UserRound, X } from "lucide-react";
import type { BabyLogKind } from "@/db/schema";
import { KIND_LABEL, KIND_ORDER } from "@/lib/baby-log";
import { REMIND_DEFAULT_EVERY, REMIND_EVERY, hoursLabel } from "@/lib/baby-reminder";
import type { BabyReminderView } from "@/lib/baby-queries";
import { cn } from "@/lib/cn";
import { deleteBabyReminder, saveBabyReminder } from "@/actions/baby-reminder";
import { Card } from "@/components/ui/card";
import { Segmented } from "@/components/ui/segmented";
import { KindBadge } from "@/components/baby/log/kind-icon";

const TIME_INPUT =
  "h-11 min-w-0 flex-1 rounded-sm border border-cream-200 bg-cream-50 px-3 text-base text-ink-900 " +
  "focus:border-[1.5px] focus:border-brown-500 focus:outline-none";

/**
 * C3 — ตั้งการแจ้งเตือน
 *
 * ประเภทที่ตั้งไว้แล้วกดไม่ได้ (บอกว่า "ตั้งแล้ว") — สองตัวเรื่องเดียวกันคือเด้งซ้อนกันสองใบ
 */
export function ReminderForm({
  childId,
  initial,
  taken,
  startKind,
}: {
  childId: string;
  initial: BabyReminderView | null;
  taken: BabyLogKind[];
  startKind: BabyLogKind;
}) {
  const router = useRouter();
  const back = `/baby/${childId}/reminders`;
  const [kind, setKind] = useState<BabyLogKind>(initial?.kind ?? startKind);
  const [every, setEvery] = useState<number>(initial?.everyMin ?? REMIND_DEFAULT_EVERY[startKind]);
  const [quietOn, setQuietOn] = useState(initial ? initial.quietFrom != null : true);
  const [from, setFrom] = useState(initial?.quietFrom ?? "23:00");
  const [to, setTo] = useState(initial?.quietTo ?? "07:00");

  const save = useAction(saveBabyReminder, {
    onSuccess: () => {
      router.push(back);
      router.refresh();
    },
  });
  const del = useAction(deleteBabyReminder, {
    onSuccess: () => {
      router.push(back);
      router.refresh();
    },
  });

  const submit = () =>
    save.execute({
      id: initial?.id,
      childId,
      kind,
      everyMin: every,
      quiet: quietOn ? { from, to } : null,
    });

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
        <h1 className="text-lg font-semibold text-ink-900">ตั้งการแจ้งเตือน</h1>
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="-mr-2 h-11 px-2 text-[15px] font-semibold text-brown-700 disabled:opacity-50"
        >
          บันทึก
        </button>
      </header>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-sm text-ink-600">เตือนเรื่อง</legend>
        <div className="grid grid-cols-3 gap-2">
          {KIND_ORDER.map((k) => {
            const on = k === kind;
            const isTaken = taken.includes(k) && k !== initial?.kind;
            return (
              <button
                key={k}
                type="button"
                aria-pressed={on}
                disabled={isTaken}
                onClick={() => {
                  setKind(k);
                  if (!initial) setEvery(REMIND_DEFAULT_EVERY[k]);
                }}
                className={cn(
                  "flex flex-col items-center gap-1 rounded-md px-1 py-2.5 disabled:opacity-40",
                  on ? "border-[1.5px] border-brown-700 bg-brown-100" : "border border-cream-200 bg-white",
                )}
              >
                <KindBadge kind={k} size={34} />
                <span className="text-xs text-ink-900">{KIND_LABEL[k]}</span>
                {isTaken && <span className="text-[11px] text-ink-600">ตั้งแล้ว</span>}
              </button>
            );
          })}
        </div>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-600">เตือนเมื่อผ่านไป</span>
        <Segmented
          label="เตือนเมื่อผ่านไป"
          options={REMIND_EVERY.map((m) => ({ value: String(m), label: hoursLabel(m) }))}
          value={String(every)}
          onChange={(v) => setEvery(Number(v))}
        />
        <p className="text-xs text-ink-400">
          นับจากครั้งล่าสุดที่บันทึก{KIND_LABEL[kind]} ไม่ใช่เวลาตายตัว
          {kind === "sleep" && " (นอนนับจากตอนตื่น)"}
        </p>
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="flex min-h-11 items-center justify-between gap-3 text-sm text-ink-600">
          งดเตือนช่วงกลางคืน
          <input
            type="checkbox"
            checked={quietOn}
            onChange={(e) => setQuietOn(e.target.checked)}
            className="size-5 accent-brown-700"
          />
        </label>
        {quietOn && (
          <>
            <div className="flex items-center gap-2.5">
              <input
                type="time"
                aria-label="งดเตือนตั้งแต่"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
                className={TIME_INPUT}
              />
              <span className="text-sm text-ink-600">ถึง</span>
              <input
                type="time"
                aria-label="งดเตือนถึง"
                value={to}
                onChange={(e) => setTo(e.target.value)}
                className={TIME_INPUT}
              />
            </div>
            <p className="text-xs text-ink-400">ถ้าครบกำหนดระหว่างนี้ จะเตือนตอน {to} ครั้งเดียว</p>
          </>
        )}
      </div>

      <Card className="flex items-center gap-2.5 p-3.5">
        <UserRound size={18} strokeWidth={1.8} className="text-ink-600" />
        <span className="flex flex-col">
          <span className="text-[13px] text-ink-600">ส่งเข้า</span>
          <span className="text-[15px] font-medium text-ink-900">เครื่องของคุณเท่านั้น</span>
        </span>
      </Card>

      {(save.result.serverError || save.result.validationErrors) && (
        <p role="alert" className="text-[13px] text-danger">
          {save.result.serverError ?? "ข้อมูลไม่ครบ ลองตรวจอีกครั้ง"}
        </p>
      )}

      {initial && (
        <button
          type="button"
          disabled={del.isPending}
          onClick={() => {
            if (confirm("ลบการแจ้งเตือนนี้?")) del.execute({ id: initial.id, childId });
          }}
          className="h-11 self-center px-3 text-sm text-danger disabled:opacity-50"
        >
          ลบการแจ้งเตือนนี้
        </button>
      )}
    </div>
  );
}
