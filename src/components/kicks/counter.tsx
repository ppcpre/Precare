"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { AlertCircle, Footprints, RotateCcw, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import {
  SLOW_MINUTES,
  elapsedMs,
  formatDuration,
  isOverTimeLimit,
  localIso,
  type SessionView,
} from "@/lib/kicks";
import { discardKickSession, finishKickSession, recordKick, undoKick } from "@/actions/kicks";

/**
 * หน้าจอตอนกำลังนับ
 *
 * ⚠️ ห้ามเขียนข้อความไหนที่แปลว่า "ปกติ" หรือ "ปลอดภัย"
 *    แอปบอกได้แค่ข้อเท็จจริง เช่น ครบแล้ว หรือ เลยเกณฑ์เวลาแล้ว
 *    การตีความเป็นหน้าที่ของแพทย์
 */
export function KickCounter({ session, canEdit }: { session: SessionView; canEdit: boolean }) {
  const router = useRouter();
  const now = useNow();

  // นับฝั่ง client ก่อนแล้วค่อยยิงไปเก็บ ปุ่มจะได้ตอบสนองทันทีที่แตะ
  // ถ้ารอ server ตอบก่อนค่อยขยับเลข จะรู้สึกหน่วงทุกครั้งบนเน็ตช้า
  const [times, setTimes] = useState<string[]>(session.events.map((e) => e.at));
  const [note, setNote] = useState("");
  const [failed, setFailed] = useState(false);

  const record = useAction(recordKick, { onError: () => setFailed(true) });
  const undo = useAction(undoKick, { onError: () => setFailed(true) });
  const finish = useAction(finishKickSession, {
    onSuccess: () => {
      router.refresh();
    },
  });
  const discard = useAction(discardKickSession, { onSuccess: () => router.refresh() });

  const count = times.length;
  const done = count >= session.target;
  // now = 0 ก่อน hydrate — ยังคำนวณเวลาไม่ได้ ให้เป็น 0 ไปก่อนแทนที่จะได้ค่าติดลบมหาศาล
  const elapsed = now === 0 ? 0 : elapsedMs(session.startedAt, now);
  const overLimit = isOverTimeLimit(elapsed);

  function tap() {
    const at = localIso();
    setTimes((cur) => [...cur, at]);
    setFailed(false);
    record.execute({ sessionId: session.id, at });
  }

  function undoOne() {
    setTimes((cur) => cur.slice(0, -1));
    setFailed(false);
    undo.execute({ sessionId: session.id });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex gap-2.5">
        <Stat label="ผ่านไปแล้ว" value={now === 0 ? "—" : formatDuration(elapsed)} warn={overLimit} />
        <Stat
          label={done ? "ได้แล้ว" : "เหลืออีก"}
          value={done ? `${count} ครั้ง` : `${session.target - count} ครั้ง`}
        />
      </div>

      {/* เกินเกณฑ์เวลาแล้วต้องขึ้นก่อนปุ่ม ไม่ใช่ให้เลื่อนหา */}
      {overLimit && !done && (
        <div className="flex flex-col gap-2 rounded-md border border-danger bg-[#FBF0EE] p-4">
          <p className="flex items-start gap-2">
            <AlertCircle size={18} strokeWidth={2} className="mt-0.5 shrink-0 text-danger" />
            <span className="text-[15px] font-medium text-ink-900">
              ผ่านไป {SLOW_MINUTES / 60} ชั่วโมงแล้วยังไม่ครบ {session.target} ครั้ง
            </span>
          </p>
          <p className="text-[13px] leading-relaxed text-ink-600">
            ตำราแนะนำให้ติดต่อแพทย์เมื่อนับไม่ครบ {session.target} ครั้งใน {SLOW_MINUTES / 60}{" "}
            ชั่วโมง นับต่อได้ แต่ควรติดต่อโรงพยาบาลไปพร้อมกัน
          </p>
        </div>
      )}

      {done ? (
        <FinishPanel
          session={session}
          elapsed={elapsed}
          note={note}
          setNote={setNote}
          canEdit={canEdit}
          pending={finish.isPending}
          onFinish={() => finish.execute({ sessionId: session.id, at: localIso(), note })}
        />
      ) : (
        <>
          <button
            type="button"
            disabled={!canEdit}
            aria-label={`บันทึกการดิ้น ตอนนี้ ${count} ครั้ง`}
            onClick={tap}
            className={cn(
              "mx-auto flex size-58 min-h-0 flex-col items-center justify-center gap-1 rounded-full",
              "border-[3px] border-peach-300 bg-peach-100 disabled:opacity-60",
              "active:scale-[0.97] transition-transform",
            )}
            style={{ width: 232, height: 232 }}
          >
            <span className="text-[68px] font-semibold leading-none text-peach-700 tabular-nums">
              {count}
            </span>
            <span className="text-[13px] text-ink-600">ครั้ง</span>
          </button>

          <p className="text-center text-sm text-ink-600">
            {canEdit ? "แตะเมื่อรู้สึกลูกดิ้น" : "คุณมีสิทธิ์ดูอย่างเดียว"}
          </p>

          <div className="flex justify-center gap-1.5" aria-hidden>
            {Array.from({ length: session.target }, (_, i) => (
              <span
                key={i}
                className={cn("size-2 rounded-full", i < count ? "bg-peach-700" : "bg-cream-200")}
              />
            ))}
          </div>

          {/* การดิ้นรัวๆ ติดกันนับเป็นครั้งเดียวตามหลักการนับสากล
              ถ้าไม่บอก ผู้ใช้จะแตะรัวแล้วได้ตัวเลขที่ไม่มีความหมายทางการแพทย์ */}
          <p className="flex items-start gap-2 rounded-sm bg-cream-100 px-3 py-2.5 text-xs leading-relaxed text-ink-600">
            <AlertCircle size={15} strokeWidth={1.9} className="mt-0.5 shrink-0 text-ink-400" />
            ดิ้นรัวๆ ติดกันนับเป็น 1 ครั้ง — แตะอีกทีเมื่อหยุดแล้วดิ้นใหม่
          </p>
        </>
      )}

      {failed && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          บันทึกครั้งล่าสุดไม่สำเร็จ ตรวจสัญญาณเน็ตแล้วแตะใหม่อีกครั้ง
        </p>
      )}

      {times.length > 0 && (
        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">เวลาที่บันทึกไว้</span>
          <div className="flex flex-wrap gap-1.5">
            {times.map((t, i) => (
              <span
                key={`${t}-${i}`}
                className="rounded-full border border-cream-200 bg-white px-3 py-1.5 text-sm tabular-nums text-ink-600"
              >
                {t.slice(11, 16)}
              </span>
            ))}
          </div>
        </div>
      )}

      {canEdit && !done && (
        <div className="flex flex-col gap-2">
          {count > 0 && (
            <Button variant="ghost" onClick={undoOne}>
              <RotateCcw size={17} strokeWidth={1.9} />
              ลบครั้งล่าสุด
            </Button>
          )}
          <Button
            variant="secondary"
            loading={finish.isPending || discard.isPending}
            onClick={() =>
              // ยังไม่ได้แตะสักครั้ง = ไม่มีอะไรให้เก็บ ทิ้งไปเลยดีกว่าให้ประวัติรก
              count === 0
                ? discard.execute({ sessionId: session.id })
                : finish.execute({ sessionId: session.id, at: localIso(), note })
            }
          >
            <Square size={16} strokeWidth={1.9} />
            {count === 0 ? "ยกเลิกรอบนี้" : "หยุดและบันทึก"}
          </Button>
          <p className="text-center text-xs text-ink-400">ปิดหน้าจอไปก่อนได้ ระบบนับต่อให้</p>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <div className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-cream-200 bg-white px-3 py-2.5">
      <span className="text-xs text-ink-600">{label}</span>
      <span
        className={cn("text-lg font-semibold tabular-nums", warn ? "text-danger" : "text-ink-900")}
      >
        {value}
      </span>
    </div>
  );
}

function FinishPanel({
  session,
  elapsed,
  note,
  setNote,
  canEdit,
  pending,
  onFinish,
}: {
  session: SessionView;
  elapsed: number;
  note: string;
  setNote: (v: string) => void;
  canEdit: boolean;
  pending: boolean;
  onFinish: () => void;
}) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col items-center gap-2.5 py-4">
        <span className="flex size-20 items-center justify-center rounded-full bg-peach-100">
          <Footprints size={38} strokeWidth={1.6} className="text-peach-700" />
        </span>
        <p className="text-xl font-semibold text-ink-900">
          ครบ {session.target} ครั้งแล้ว
        </p>
        <p className="text-[15px] text-ink-600">ใช้เวลา {formatDuration(elapsed)}</p>
      </div>

      {canEdit && (
        <>
          <Textarea
            label="บันทึกเพิ่มเติม"
            rows={2}
            placeholder="เช่น ดิ้นแรงกว่าปกติ หรือนับหลังอาหารเย็น"
            value={note}
            maxLength={500}
            onChange={(e) => setNote(e.target.value)}
          />
          <Button full loading={pending} onClick={onFinish}>
            บันทึก
          </Button>
        </>
      )}
      <p className="text-center text-xs leading-relaxed text-ink-400">
        ตัวเลขนี้ใช้เทียบกับรูปแบบของลูกคุณเองเท่านั้น ไม่ใช่การประเมินสุขภาพ
        ถ้ารู้สึกว่าผิดไปจากเดิมให้ปรึกษาแพทย์
      </p>
    </div>
  );
}
