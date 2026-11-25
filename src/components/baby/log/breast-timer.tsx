"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { ArrowLeftRight, Square } from "lucide-react";
import { addBabyLog, deleteBabyLog, startBabyTimer, stopBabyTimer, tapBreastSide } from "@/actions/baby-log";
import { SIDE_LABEL, breastTotals, clockSec, secondsBetween, type BreastSide } from "@/lib/baby-log";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { atFromTime } from "./time-field";

export type BreastState = {
  id: string | null;
  startedAt: string;
  leftSec: number;
  rightSec: number;
  side: BreastSide;
  sideStartedAt: string | null;
};

/**
 * B2 — ให้นมแม่ จับเวลาแยกข้าง
 *
 * สถานะอยู่ฝั่ง client ก่อนแล้วค่อยยิงไปบันทึก ปุ่มต้องตอบสนองทันทีที่แตะ
 * (แม่อุ้มลูกอยู่มือเดียว แตะแล้วไม่เปลี่ยนจะแตะซ้ำ แล้วกลายเป็นพัก)
 * รอบอยู่ใน D1 ตั้งแต่แตะครั้งแรก ปิดจอ สลับแอป หรือเปิดจากอีกเครื่องก็ต่อได้
 */
export function BreastTimer({
  childId,
  childName,
  initial,
  suggested,
  lastNote,
  canWrite,
}: {
  childId: string;
  childName: string;
  initial: BreastState | null;
  suggested: BreastSide | null;
  lastNote: string | null;
  canWrite: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const [s, setS] = useState<BreastState | null>(initial);
  const [manual, setManual] = useState(false);
  const back = `/baby/${childId}/log`;
  const fail = () => router.refresh();

  const start = useAction(startBabyTimer, {
    onSuccess: ({ data }) => {
      if (!data) return;
      if (data.resumed) router.refresh();
      else setS((cur) => (cur ? { ...cur, id: data.id } : cur));
    },
    onError: fail,
  });
  const tap = useAction(tapBreastSide, { onError: fail });
  const stop = useAction(stopBabyTimer, { onSuccess: () => router.push(back), onError: fail });
  const discard = useAction(deleteBabyLog, { onSuccess: () => router.push(back) });

  function onSide(side: BreastSide) {
    if (!canWrite) return;
    const at = localIso();
    if (!s) {
      setS({ id: null, startedAt: at, leftSec: 0, rightSec: 0, side, sideStartedAt: at });
      start.execute({ childId, kind: "breast", side, at });
      return;
    }
    if (!s.id) return; // ยังรอ id ของรอบจากเซิร์ฟเวอร์อยู่ — ไม่กี่ร้อยมิลลิวินาที
    let { leftSec, rightSec } = s;
    if (s.sideStartedAt) {
      const live = secondsBetween(s.sideStartedAt, at);
      if (s.side === "left") leftSec += live;
      else rightSec += live;
    }
    const pausing = s.sideStartedAt !== null && s.side === side;
    setS({ ...s, leftSec, rightSec, side, sideStartedAt: pausing ? null : at });
    tap.execute({ logId: s.id, side, at });
  }

  if (manual) {
    return <ManualBreast childId={childId} suggested={suggested} onDone={() => router.push(back)} onCancel={() => setManual(false)} />;
  }

  const totals = s && nowIso ? breastTotals({ ...s, endedAt: null }, nowIso) : { left: 0, right: 0 };
  const active = s?.sideStartedAt ? s.side : null;

  return (
    <div className="flex flex-col gap-4 pb-28">
      <div className="flex flex-col items-center pt-2">
        <span className="text-[13px] text-ink-600">รวม</span>
        <span className="text-5xl font-semibold tabular-nums text-ink-900">
          {clockSec(totals.left + totals.right)}
        </span>
        {s && !active && <span className="text-[13px] text-ink-600">พักอยู่ · แตะข้างไหนก็ได้เพื่อให้ต่อ</span>}
      </div>

      <div className="grid grid-cols-2 gap-3">
        {(["left", "right"] as const).map((side) => {
          const on = active === side;
          const hint = !s && suggested === side;
          return (
            <button
              key={side}
              type="button"
              disabled={!canWrite}
              onClick={() => onSide(side)}
              aria-pressed={on}
              className={cn(
                "flex min-h-40 flex-col items-center justify-center gap-1 rounded-lg border-2 transition-colors active:scale-[0.98]",
                on ? "border-transparent bg-peach-700 text-white" : "bg-peach-100 text-ink-900",
                hint ? "border-peach-700" : !on && "border-transparent",
              )}
            >
              <span className="text-lg font-medium">{SIDE_LABEL[side]}</span>
              <span className="text-3xl font-semibold tabular-nums">
                {clockSec(side === "left" ? totals.left : totals.right)}
              </span>
              <span className={cn("text-xs", on ? "text-white/85" : "text-ink-600")}>
                {on ? "กำลังจับเวลา · แตะเพื่อพัก" : hint ? "แนะนำข้างนี้ก่อน" : s ? "แตะเพื่อสลับ" : "แตะเพื่อเริ่ม"}
              </span>
            </button>
          );
        })}
      </div>

      {lastNote && (
        <p className="flex items-center gap-2 rounded-md bg-cream-100 px-3 py-2.5 text-[13px] text-ink-600">
          <ArrowLeftRight size={15} className="shrink-0 text-ink-400" />
          {lastNote}
        </p>
      )}

      {s && (
        <p className="text-center text-[13px] text-ink-600">
          เริ่ม {s.startedAt.slice(11, 16)} น.
          {canWrite && s.id && (
            <>
              {" · "}
              <button
                type="button"
                className="text-brown-700 underline-offset-2 hover:underline"
                onClick={() => confirm("ทิ้งรอบนี้? จะไม่ถูกบันทึก") && discard.execute({ logId: s.id! })}
              >
                ทิ้งรอบนี้
              </button>
            </>
          )}
        </p>
      )}

      {!s && canWrite && (
        <p className="text-center text-[13px] text-ink-600">
          ลืมกดเริ่ม?{" "}
          <button type="button" onClick={() => setManual(true)} className="font-medium text-brown-700">
            ใส่ย้อนหลังแทน
          </button>
        </p>
      )}

      {!canWrite && (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-center text-[13px] text-ink-600">
          คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้
        </p>
      )}

      {s && canWrite && (
        <div className="fixed inset-x-0 bottom-16 border-t border-cream-200 bg-white p-4 md:bottom-0">
          <div className="mx-auto flex max-w-md flex-col gap-1.5">
            <Button
              full
              loading={stop.isPending}
              disabled={!s.id}
              onClick={() => s.id && stop.execute({ logId: s.id, at: localIso() })}
            >
              <Square size={16} fill="currentColor" />
              หยุดและบันทึก
            </Button>
            <p className="text-center text-[11px] text-ink-400">
              ปิดหน้านี้ไปก่อนได้ ระบบนับต่อให้ · คนอื่นในบ้านเห็นว่า{childName}กำลังกินนมอยู่
            </p>
          </div>
        </div>
      )}
      <Link href={back} className="sr-only">
        กลับหน้าวันนี้
      </Link>
    </div>
  );
}

function ManualBreast({
  childId,
  suggested,
  onDone,
  onCancel,
}: {
  childId: string;
  suggested: BreastSide | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [time, setTime] = useState("");
  const [left, setLeft] = useState("");
  const [right, setRight] = useState("");
  const [last, setLast] = useState<BreastSide>(suggested === "left" ? "right" : "left");
  const add = useAction(addBabyLog, { onSuccess: onDone });

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!time) return;
        add.execute({
          kind: "breast",
          childId,
          at: atFromTime(time, localIso()),
          leftMin: Number(left) || 0,
          rightMin: Number(right) || 0,
          lastSide: last,
        });
      }}
    >
      <h2 className="text-lg font-semibold text-ink-900">ใส่ย้อนหลัง</h2>
      <label className="flex flex-col gap-1 text-sm text-ink-600">
        เริ่มตอน
        <input
          type="time"
          required
          value={time}
          onChange={(e) => setTime(e.target.value)}
          className="h-11 rounded-md border border-cream-300 px-3 text-base text-ink-900"
        />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <MinField label="ซ้าย (นาที)" value={left} onChange={setLeft} />
        <MinField label="ขวา (นาที)" value={right} onChange={setRight} />
      </div>
      <fieldset className="flex flex-col gap-1 text-sm text-ink-600">
        <legend>จบที่ข้างไหน</legend>
        <div className="mt-1 flex gap-2">
          {(["left", "right"] as const).map((v) => (
            <button
              key={v}
              type="button"
              aria-pressed={last === v}
              onClick={() => setLast(v)}
              className={cn(
                "h-11 flex-1 rounded-md border text-[15px]",
                last === v ? "border-peach-700 bg-peach-100 font-medium text-ink-900" : "border-cream-300 text-ink-600",
              )}
            >
              {SIDE_LABEL[v]}
            </button>
          ))}
        </div>
      </fieldset>
      {add.result.serverError && <p role="alert" className="text-[13px] text-danger">{add.result.serverError}</p>}
      {add.result.validationErrors && <p role="alert" className="text-[13px] text-danger">ข้อมูลไม่ถูกต้อง ตรวจเวลาอีกครั้ง</p>}
      <Button type="submit" full loading={add.isPending}>
        บันทึก
      </Button>
      <Button type="button" variant="ghost" full onClick={onCancel}>
        กลับไปจับเวลา
      </Button>
    </form>
  );
}

function MinField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex flex-col gap-1 text-sm text-ink-600">
      {label}
      <input
        type="number"
        inputMode="numeric"
        min={0}
        max={120}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        className="h-11 rounded-md border border-cream-300 px-3 text-base tabular-nums text-ink-900"
      />
    </label>
  );
}
