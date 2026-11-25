"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Moon, Square, Trash2 } from "lucide-react";
import { addBabyLog, deleteBabyLog, setSleepStart, startBabyTimer, stopBabyTimer } from "@/actions/baby-log";
import { clockSec, secondsBetween, spanLabel } from "@/lib/baby-log";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { Button } from "@/components/ui/button";
import { TimeField, atFromTime } from "./time-field";

/**
 * B5 — นอน
 *
 * หนึ่งรอบต่อลูก ทั้งบ้านเห็นรอบเดียวกัน — พ่อกดเริ่ม แม่หยุดจากเครื่องตัวเองได้
 * ถ้าอีกคนเป็นคนเริ่ม ขึ้นแถบบอกไว้ จะได้ไม่งงว่านาฬิกามาจากไหน
 */
export function SleepTimer({
  childId,
  open,
  startedByOther,
  todaySec,
  longestSec,
  canWrite,
}: {
  childId: string;
  open: { id: string; startedAt: string } | null;
  startedByOther: string | null;
  todaySec: number;
  longestSec: number;
  canWrite: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const back = `/baby/${childId}/log`;
  const [startAt, setStartAt] = useState<string | null>(open?.startedAt ?? null);
  const [pickStart, setPickStart] = useState<string | null>(null);
  const [manual, setManual] = useState(false);
  const refresh = () => router.refresh();

  const start = useAction(startBabyTimer, { onSuccess: refresh, onError: refresh });
  const stop = useAction(stopBabyTimer, { onSuccess: () => router.push(back), onError: refresh });
  const fix = useAction(setSleepStart, { onSuccess: refresh });
  const discard = useAction(deleteBabyLog, { onSuccess: () => router.push(back) });

  if (manual) return <ManualSleep childId={childId} onDone={() => router.push(back)} onCancel={() => setManual(false)} />;

  const running = startAt != null;
  const liveSec = running && nowIso ? secondsBetween(startAt, nowIso) : 0;

  return (
    <div className="flex flex-col gap-4 pb-28">
      {startedByOther && open && (
        <p className="flex items-center gap-2 rounded-md bg-sky-100 px-3 py-2.5 text-[13px] text-ink-900">
          {startedByOther}เริ่มจับเวลาไว้ตอน {open.startedAt.slice(11, 16)} · หยุดจากเครื่องไหนก็ได้
        </p>
      )}

      <div className="flex flex-col items-center gap-2 pt-4">
        <span className="flex size-24 items-center justify-center rounded-full bg-plum-700 text-white">
          <Moon size={40} strokeWidth={1.7} />
        </span>
        <span className="text-[15px] font-medium text-plum-700">{running ? "กำลังนอน" : "ยังไม่ได้เริ่ม"}</span>
        <span className="text-5xl font-semibold tabular-nums text-ink-900">{clockSec(liveSec)}</span>
      </div>

      {canWrite && (
        running && open ? (
          <TimeField
            label="เริ่ม"
            value={startAt!.slice(11, 16)}
            nowIso={nowIso ?? startAt!}
            onChange={(v) => {
              if (!v) return;
              const at = atFromTime(v, localIso());
              setStartAt(at);
              fix.execute({ logId: open.id, at });
            }}
          />
        ) : (
          <TimeField label="เริ่ม" value={pickStart} onChange={setPickStart} nowIso={nowIso ?? ""} />
        )
      )}
      {fix.result.serverError && <p role="alert" className="text-[13px] text-danger">{fix.result.serverError}</p>}

      <div className="grid grid-cols-2 gap-2">
        <Stat label="วันนี้รวม" value={spanLabel(todaySec + liveSec)} />
        <Stat label="รอบยาวสุดวันนี้" value={spanLabel(Math.max(longestSec, liveSec))} />
      </div>

      {!running && canWrite && (
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

      {canWrite && (
        <div className="fixed inset-x-0 bottom-16 border-t border-cream-200 bg-white p-4 md:bottom-0">
          <div className="mx-auto flex max-w-md items-center gap-2">
            {running && open && (
              <button
                type="button"
                aria-label="ทิ้งรอบนี้"
                onClick={() => confirm("ทิ้งรอบนี้? จะไม่ถูกบันทึก") && discard.execute({ logId: open.id })}
                className="flex size-11 shrink-0 items-center justify-center rounded-md border border-cream-300 text-ink-600"
              >
                <Trash2 size={18} />
              </button>
            )}
            {running && open ? (
              <Button full loading={stop.isPending} onClick={() => stop.execute({ logId: open.id, at: localIso() })}>
                <Square size={16} fill="currentColor" />
                ตื่นแล้ว · หยุด
              </Button>
            ) : (
              <Button
                full
                loading={start.isPending}
                onClick={() => {
                  const at = pickStart ? atFromTime(pickStart, localIso()) : localIso();
                  setStartAt(at);
                  start.execute({ childId, kind: "sleep", at });
                }}
              >
                <Moon size={17} />
                เริ่มนอน
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-md border border-cream-200 bg-white p-3">
      <span className="text-xs text-ink-600">{label}</span>
      <span className="text-lg font-semibold tabular-nums text-ink-900">{value}</span>
    </div>
  );
}

function ManualSleep({ childId, onDone, onCancel }: { childId: string; onDone: () => void; onCancel: () => void }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const add = useAction(addBabyLog, { onSuccess: onDone });
  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (!from || !to) return;
        const nowIso = localIso();
        const endAt = atFromTime(to, nowIso);
        // เวลาหลับที่ใกล้ที่สุดก่อนเวลาตื่น — หลับ 23:00 ตื่น 02:00 จึงได้ของเมื่อวานเอง
        const at = atFromTime(from, endAt);
        add.execute({ kind: "sleep", childId, at, endAt });
      }}
    >
      <h2 className="text-lg font-semibold text-ink-900">ใส่ย้อนหลัง</h2>
      <div className="grid grid-cols-2 gap-3">
        <label className="flex flex-col gap-1 text-sm text-ink-600">
          หลับตอน
          <input type="time" required value={from} onChange={(e) => setFrom(e.target.value)} className="h-11 rounded-md border border-cream-300 px-3 text-base text-ink-900" />
        </label>
        <label className="flex flex-col gap-1 text-sm text-ink-600">
          ตื่นตอน
          <input type="time" required value={to} onChange={(e) => setTo(e.target.value)} className="h-11 rounded-md border border-cream-300 px-3 text-base text-ink-900" />
        </label>
      </div>
      {add.result.serverError && <p role="alert" className="text-[13px] text-danger">{add.result.serverError}</p>}
      <Button type="submit" full loading={add.isPending}>
        บันทึก
      </Button>
      <Button type="button" variant="ghost" full onClick={onCancel}>
        กลับไปจับเวลา
      </Button>
    </form>
  );
}
