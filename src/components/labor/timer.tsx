"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { AlertCircle, Check, Square, Waves } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNow } from "@/lib/use-now";
import { useWakeLock } from "@/components/labor/wake-lock";
import { cn } from "@/lib/cn";
import {
  RULE,
  checkRule,
  clock,
  durationOf,
  gapOf,
  localIso,
  seconds,
  type Contraction,
  type LaborSessionView,
} from "@/lib/labor";
import { beginContraction, closeLaborSession, endContraction } from "@/actions/labor";

/**
 * หน้าจอตอนกำลังจับเวลา
 *
 * ⚠️ ข้อห้ามเข้มกว่านับลูกดิ้น เพราะหน้านี้ถูกใช้ตอนตัดสินใจว่าจะไปโรงพยาบาลไหม
 *    **ห้ามมีข้อความไหนที่แปลว่า "ยังไม่ต้องไป" หรือ "รอได้"**
 *    ยังไม่เข้าเกณฑ์ไม่ได้แปลว่าไม่ต้องไป และเข้าเกณฑ์ก็บอกได้แค่ว่า
 *    ตรงกับเกณฑ์ที่ตำราใช้ ไม่ใช่ "ถึงเวลาแล้ว"
 */
export function LaborTimer({
  session,
  canEdit,
}: {
  session: LaborSessionView;
  canEdit: boolean;
}) {
  const router = useRouter();
  const now = useNow();

  // เก็บสถานะฝั่ง client ก่อนแล้วค่อยยิงไปบันทึก ปุ่มจะได้ตอบสนองทันทีที่แตะ
  // ตอนเจ็บท้องความหน่วงครึ่งวินาทีทำให้กดซ้ำ แล้วข้อมูลจะเพี้ยน
  const [list, setList] = useState<Contraction[]>(session.contractions);
  const [failed, setFailed] = useState(false);

  const begin = useAction(beginContraction, { onError: () => setFailed(true) });
  const end = useAction(endContraction, { onError: () => setFailed(true) });
  const close = useAction(closeLaborSession, { onSuccess: () => router.refresh() });

  const ongoing = list.at(-1)?.to === null ? list.at(-1)! : null;
  useWakeLock(true);

  const rule = checkRule(list);
  // now = 0 ก่อน hydrate — ยังคำนวณเวลาไม่ได้
  const sessionMs = now === 0 ? 0 : Math.max(0, now - new Date(session.startedAt).getTime());
  const holdMs = ongoing && now !== 0 ? Math.max(0, now - new Date(ongoing.at).getTime()) : 0;

  function tap() {
    if (!canEdit) return;
    const at = localIso();
    setFailed(false);
    if (ongoing) {
      setList((cur) => cur.map((c, i) => (i === cur.length - 1 ? { ...c, to: at } : c)));
      end.execute({ sessionId: session.id, at });
    } else {
      setList((cur) => [...cur, { at, to: null }]);
      begin.execute({ sessionId: session.id, at });
    }
  }

  const done = list.filter((c) => c.to != null);
  const rows = [...done].reverse().slice(0, 8);

  return (
    <div className="flex flex-col gap-4 pb-24">
      <div className="flex gap-2.5">
        <Pill label="จับมาแล้ว" value={sessionMs ? clock(sessionMs) : "—"} />
        <Pill label="บันทึกไว้" value={`${done.length} ครั้ง`} />
      </div>

      {rule.met && <MetCard />}

      {/* ปุ่มเดียวทำสองหน้าที่ กดตอนเริ่มบีบ กดอีกทีตอนคลาย
          ใหญ่เต็มความกว้างเพราะใช้ตอนเจ็บ มือสั่น และบางทีหลับตาอยู่ */}
      <button
        type="button"
        disabled={!canEdit}
        onClick={tap}
        aria-label={ongoing ? "แตะเมื่อคลายแล้ว" : "แตะเมื่อเริ่มบีบ"}
        className={cn(
          "mx-auto flex aspect-square w-full max-w-[260px] flex-col items-center justify-center gap-1.5 rounded-full",
          ongoing ? "bg-brown-700 text-white" : "border-[3px] border-cream-200 bg-cream-100",
        )}
      >
        {ongoing ? (
          <>
            <span className="text-[15px] text-white/85">กำลังบีบ</span>
            <span className="text-5xl font-semibold tabular-nums text-white">{clock(holdMs)}</span>
            <span className="text-[13px] text-white/85">แตะอีกครั้งเมื่อคลายแล้ว</span>
          </>
        ) : (
          <>
            <Waves size={34} strokeWidth={1.8} className="text-brown-500" />
            <span className="text-[19px] font-semibold text-brown-900">แตะเมื่อเริ่มบีบ</span>
            {done.length > 0 && now !== 0 && (
              <span className="text-[13px] text-ink-600">
                ครั้งล่าสุด {clock(now - new Date(done[done.length - 1].at).getTime())} ที่แล้ว
              </span>
            )}
          </>
        )}
      </button>

      {ongoing ? (
        // ตอนกำลังบีบคือตอนที่เจ็บที่สุด ต้องไม่มีอะไรให้อ่านหรือให้ตัดสินใจ
        <p className="rounded-md border border-cream-200 bg-cream-100 p-3.5 text-center text-[13px] leading-relaxed text-ink-600">
          ตอนนี้ต้องการแค่ให้แตะอีกครั้งเมื่อคลายแล้ว อย่างอื่นรอได้
        </p>
      ) : (
        <RuleCard rule={rule} />
      )}

      {rows.length > 0 && !ongoing && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-ink-600">ครั้งที่ผ่านมา</h2>
          <div className="flex px-3 text-[11px] text-ink-400">
            <span className="w-[54px] shrink-0">เวลา</span>
            <span className="flex-1">ความนาน</span>
            <span>ห่างจากครั้งก่อน</span>
          </div>
          {rows.map((c, i) => {
            const prev = done[done.length - 1 - i - 1];
            const d = durationOf(c);
            return (
              <div
                key={c.at}
                className="flex items-center gap-2 rounded-[10px] border border-cream-200 bg-white px-3 py-2.5"
              >
                <span className="w-[54px] shrink-0 text-[13px] text-ink-400">
                  {c.at.slice(11, 16)}
                </span>
                <span className="flex-1 text-[13px] text-ink-900">{d != null ? seconds(d) : "—"}</span>
                <span className="text-xs tabular-nums text-ink-400">
                  {prev ? clock(gapOf(prev, c)) : "—"}
                </span>
              </div>
            );
          })}
        </section>
      )}

      {failed && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          บันทึกครั้งล่าสุดไม่สำเร็จ ลองแตะอีกครั้ง
        </p>
      )}

      {canEdit && !ongoing && (
        <div className="fixed inset-x-0 bottom-16 border-t border-cream-200 bg-white p-4 md:bottom-0">
          <div className="mx-auto flex max-w-[560px] flex-col gap-2">
            <Button
              full
              variant="secondary"
              loading={close.isPending}
              onClick={() => close.execute({ sessionId: session.id, at: localIso() })}
            >
              <Square size={17} strokeWidth={1.9} />
              หยุดจับเวลาและบันทึก
            </Button>
            <span className="text-center text-xs text-ink-400">ปิดหน้าจอไปก่อนได้ ระบบจับต่อให้</span>
          </div>
        </div>
      )}
    </div>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="flex flex-1 flex-col gap-0.5 rounded-[10px] border border-cream-200 bg-white px-3 py-2.5">
      <span className="text-xs text-ink-600">{label}</span>
      <span className="text-[17px] font-semibold tabular-nums text-ink-900">{value}</span>
    </span>
  );
}

/**
 * เข้าเกณฑ์แล้ว
 *
 * ข้อความนี้ถูกเขียนอย่างระวังที่สุดในทั้งแอป — บอกว่า "ตรงกับเกณฑ์ที่ตำราใช้"
 * ไม่ใช่ "ถึงเวลาแล้ว" หรือ "คลอดแล้ว" เพราะคนตัดสินคือหมอ
 */
function MetCard() {
  return (
    <section className="flex flex-col gap-2 rounded-md border border-danger bg-[#FBF0EE] p-3.5">
      <p className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
        <AlertCircle size={18} strokeWidth={2} className="text-danger" />
        ตรงกับเกณฑ์ {RULE.maxGapMinutes}-1-1 แล้ว
      </p>
      <p className="text-[13px] leading-relaxed text-ink-600">
        ตำราแนะนำให้ติดต่อโรงพยาบาลตอนนี้ · เกณฑ์นี้เป็นแนวทางทั่วไป ไม่ใช่การวินิจฉัย
        บางคนหมออาจนัดให้มาเร็วหรือช้ากว่านี้ตามประวัติของแต่ละคน
      </p>
    </section>
  );
}

function RuleCard({ rule }: { rule: ReturnType<typeof checkRule> }) {
  const done = [rule.gapOk, rule.durationOk, rule.sustainedOk].filter(Boolean).length;
  return (
    <section className="flex flex-col gap-2.5 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]">
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-ink-900">เกณฑ์ {RULE.maxGapMinutes}-1-1</span>
        <span className="text-xs text-ink-400">ครบ {done} จาก 3</span>
      </div>
      <span className="h-px bg-cream-200" />
      <Line
        label={`ห่างกันไม่เกิน ${RULE.maxGapMinutes} นาที`}
        value={rule.avgGapMs != null ? clock(rule.avgGapMs) : "—"}
        ok={rule.gapOk}
      />
      <Line
        label={`บีบนานอย่างน้อย ${RULE.minDurationSeconds} วินาที`}
        value={rule.avgDurationMs != null ? seconds(rule.avgDurationMs) : "—"}
        ok={rule.durationOk}
      />
      <Line
        label={`เป็นแบบนี้ต่อเนื่อง ${RULE.sustainedMinutes} นาที`}
        value={rule.sustainedMs ? clock(rule.sustainedMs) : "—"}
        ok={rule.sustainedOk}
      />
      {/* ต้องไม่มีข้อความว่า "ยังไม่ต้องไป" ตรงนี้ — ยังไม่ครบเกณฑ์ไม่ได้แปลว่ารอได้ */}
      <p className="text-[11px] leading-relaxed text-ink-400">
        ให้ยึดตามที่หมอสั่งเป็นหลัก บางที่ใช้เกณฑ์ต่างจากนี้
      </p>
    </section>
  );
}

function Line({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center gap-2">
      {ok ? (
        <Check size={15} strokeWidth={2.6} className="shrink-0 text-success" />
      ) : (
        <span aria-hidden className="size-[15px] shrink-0 rounded-full border-[1.5px] border-cream-300" />
      )}
      <span className="flex-1 text-[13px] text-ink-600">{label}</span>
      <span className={cn("text-sm tabular-nums", ok ? "font-semibold text-ink-900" : "text-ink-400")}>
        {value}
      </span>
    </div>
  );
}
