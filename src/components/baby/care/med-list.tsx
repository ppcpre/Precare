"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { AlertTriangle, Check, Pencil, Pill, Trash2 } from "lucide-react";
import { deleteChildMedDose, giveChildMed } from "@/actions/child-care";
import { secondsBetween, spanLabel } from "@/lib/baby-log";
import { doseWarning, gapLabel, parseTimes, ruleLabel, type DoseWarning } from "@/lib/child-meds";
import type { ChildMedView } from "@/lib/child-care-queries";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const hm = (iso: string) => iso.slice(11, 16);

/**
 * D2 — ยาของลูก ทุกคนในบ้านเห็นว่าใครให้ไปแล้วเมื่อไหร่
 * D3 — กันให้ซ้ำ: เซิร์ฟเวอร์ตอบกลับมาว่าเข้าข่าย หน้าจอถามด้วยข้อเท็จจริง ไม่ตัดสินแทน
 */
export function MedList({
  childId,
  meds,
  meId,
  canWrite,
}: {
  childId: string;
  meds: ChildMedView[];
  meId: string;
  canWrite: boolean;
}) {
  const active = meds.filter((m) => m.active);
  const stopped = meds.filter((m) => !m.active);
  return (
    <div className="flex flex-col gap-3">
      {active.map((m, i) => (
        <MedCard key={m.id} childId={childId} med={m} meId={meId} canWrite={canWrite} open={i === 0} />
      ))}
      {stopped.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-sm text-ink-600">หยุดให้แล้ว</h2>
          {stopped.map((m) => (
            <MedCard key={m.id} childId={childId} med={m} meId={meId} canWrite={canWrite} open={false} />
          ))}
        </section>
      )}
    </div>
  );
}

const who = (d: { givenBy: string; givenByName: string | null }, meId: string) =>
  d.givenBy === meId ? "คุณ" : (d.givenByName ?? "สมาชิก");

function MedCard({
  childId,
  med,
  meId,
  canWrite,
  open,
}: {
  childId: string;
  med: ChildMedView;
  meId: string;
  canWrite: boolean;
  open: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const [warning, setWarning] = useState<DoseWarning | null>(null);
  const [expanded, setExpanded] = useState(open);

  const give = useAction(giveChildMed, {
    onSuccess: ({ data }) => {
      if (data && !data.saved) setWarning(data.warning);
      else {
        setWarning(null);
        router.refresh();
      }
    },
  });
  const undo = useAction(deleteChildMedDose, { onSuccess: () => router.refresh() });

  const last = med.doses[0];
  const today = nowIso?.slice(0, 10);
  const todays = med.doses.filter((d) => d.givenAt.slice(0, 10) === today);
  const planned = parseTimes(med.times).length || 1;
  const pending = nowIso ? doseWarning(med, med.doses, nowIso) : null;

  const badge =
    med.mode === "prn"
      ? "ตามอาการ"
      : todays.length >= planned
        ? "ให้แล้ววันนี้"
        : `วันนี้ ${todays.length}/${planned}`;

  return (
    <Card className={cn("flex flex-col gap-3", expanded ? "p-4" : "p-3.5", !med.active && "opacity-70")}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="flex items-center justify-between gap-3 text-left"
      >
        <span className="flex min-w-0 items-center gap-2.5">
          <span
            className={cn(
              "flex size-10 shrink-0 items-center justify-center rounded-full",
              med.active ? "bg-brown-100 text-brown-700" : "bg-cream-100 text-ink-600",
            )}
          >
            <Pill size={20} strokeWidth={1.8} />
          </span>
          <span className="flex min-w-0 flex-col">
            <span className="text-[15px] font-semibold text-ink-900">{med.name}</span>
            <span className="text-xs text-ink-600">{ruleLabel(med)}</span>
          </span>
        </span>
        {med.active && (
          <span className="shrink-0 rounded-full bg-cream-100 px-2.5 py-1 text-xs text-ink-600">{badge}</span>
        )}
      </button>

      {expanded && (
        <>
          <div className="flex flex-col gap-0.5 rounded-md border border-cream-200 bg-cream-50 p-3">
            {last && nowIso ? (
              <>
                <span className="text-[15px] font-medium text-ink-900">
                  ให้ล่าสุด {hm(last.givenAt)}
                  {last.givenAt.slice(0, 10) !== today && ` (${last.givenAt.slice(8, 10)}/${last.givenAt.slice(5, 7)})`} โดย
                  {who(last, meId)}
                </span>
                <span className="text-[13px] text-ink-600">
                  ผ่านมา {spanLabel(secondsBetween(last.givenAt, nowIso))}
                  {med.minGapMin ? ` · ช่วงห่างที่ตั้งไว้ ${gapLabel(med.minGapMin)}` : ""}
                </span>
              </>
            ) : (
              <span className="text-[13px] text-ink-600">ยังไม่เคยบันทึกว่าให้ยานี้</span>
            )}
          </div>

          {canWrite && med.active && (
            <Button
              full
              variant={pending ? "secondary" : "primary"}
              loading={give.isPending}
              onClick={() => give.execute({ medId: med.id, at: localIso(), confirm: false })}
            >
              <Check size={18} strokeWidth={2} />
              บันทึกว่าให้ยาแล้ว
            </Button>
          )}
          {give.result.serverError && (
            <p role="alert" className="text-[13px] text-danger">
              {give.result.serverError}
            </p>
          )}

          {todays.length > 0 && (
            <div className="flex flex-col">
              <span className="text-[13px] text-ink-400">วันนี้</span>
              <ul>
                {todays.map((d) => (
                  <li key={d.id} className="flex items-center justify-between gap-2 border-t border-cream-200 py-1.5">
                    <span className="flex items-center gap-2 text-sm text-ink-900">
                      <Check size={16} strokeWidth={2} className="text-sage-700" />
                      {hm(d.givenAt)}
                    </span>
                    <span className="flex items-center gap-1 text-[13px] text-ink-600">
                      โดย{who(d, meId)}
                      {canWrite && (
                        <button
                          type="button"
                          aria-label={`ลบรายการให้ยา ${hm(d.givenAt)}`}
                          disabled={undo.isPending}
                          onClick={() => {
                            if (confirm(`ลบรายการให้ยา ${hm(d.givenAt)}?`)) undo.execute({ doseId: d.id });
                          }}
                          className="flex size-11 items-center justify-center rounded-full text-ink-400 hover:bg-cream-100 hover:text-danger"
                        >
                          <Trash2 size={15} strokeWidth={1.9} />
                        </button>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {canWrite && (
            <Link
              href={`/baby/${childId}/meds/${med.id}`}
              className="flex min-h-11 items-center justify-center gap-1.5 self-center px-2 text-[13px] text-brown-700"
            >
              <Pencil size={14} strokeWidth={1.9} />
              แก้ / หยุดให้ยานี้
            </Link>
          )}
        </>
      )}

      {warning && nowIso && (
        <DoubleDoseDialog
          medName={med.name}
          warning={warning}
          meId={meId}
          nowIso={nowIso}
          pending={give.isPending}
          onCancel={() => setWarning(null)}
          onConfirm={() => give.execute({ medId: med.id, at: localIso(), confirm: true })}
        />
      )}
    </Card>
  );
}

/**
 * D3 — ข้อเท็จจริงล้วน: ใครให้ เมื่อไหร่ ห่างกี่นาที และช่วงห่างที่ "คุณ" ตั้งไว้
 * ปุ่มหลักคือ "ยังไม่ให้" — ทางที่ปลอดภัยต้องกดง่ายที่สุด
 */
function DoubleDoseDialog({
  medName,
  warning,
  meId,
  nowIso,
  pending,
  onCancel,
  onConfirm,
}: {
  medName: string;
  warning: DoseWarning;
  meId: string;
  nowIso: string;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const by = who(warning.last, meId);
  const since = spanLabel(secondsBetween(warning.last.givenAt, nowIso));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-900/40 px-5" onClick={onCancel}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="dd-title"
        className="flex w-full max-w-sm flex-col gap-3.5 rounded-[18px] bg-white p-5"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="dd-title" className="flex items-center gap-2 text-[17px] font-semibold text-ink-900">
          <AlertTriangle size={22} strokeWidth={1.9} className="text-warning" />
          {by === "คุณ" ? "คุณเพิ่งให้ยานี้ไป" : `${by}เพิ่งให้ยานี้ไป`}
        </h2>
        <p className="-mt-2 text-[13px] text-ink-600">{medName}</p>
        <dl className="flex flex-col gap-2 rounded-md border border-cream-200 bg-cream-50 p-3 text-sm">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-600">ให้ล่าสุด</dt>
            <dd className="font-medium text-ink-900">
              {hm(warning.last.givenAt)} โดย{by}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-600">ผ่านมา</dt>
            <dd className="font-semibold text-danger">{since}</dd>
          </div>
          {warning.gapMin ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-600">ช่วงห่างที่ตั้งไว้</dt>
              <dd className="font-medium text-ink-900">{gapLabel(warning.gapMin)}</dd>
            </div>
          ) : warning.today ? (
            <div className="flex justify-between gap-2">
              <dt className="text-ink-600">วันนี้ให้ไปแล้ว</dt>
              <dd className="font-medium text-ink-900">
                {warning.today.given} จาก {warning.today.planned} ครั้งที่ตั้งไว้
              </dd>
            </div>
          ) : null}
        </dl>
        <p className="text-[13px] leading-relaxed text-ink-600">
          ถ้าไม่แน่ใจ {by === "คุณ" ? "" : `ให้ถาม${by}ก่อน หรือ`}โทรถามแพทย์/เภสัชกร
        </p>
        <Button full onClick={onCancel}>
          ยังไม่ให้
        </Button>
        <Button full variant="ghost" loading={pending} onClick={onConfirm}>
          บันทึกต่อ (เช่น เวลาก่อนหน้าผิด)
        </Button>
      </div>
    </div>
  );
}
