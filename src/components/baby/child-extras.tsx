"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Check, ChevronDown } from "lucide-react";
import type { MilestoneKind } from "@/db/schema";
import { clearMilestone, saveMeasurement, setMilestone } from "@/actions/children";
import { MILESTONES } from "@/lib/milestones";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { ChildForm } from "@/components/baby/child-form";
import { ageLabel } from "@/lib/child-age";
import { localToday } from "@/lib/local-time";
import { cn } from "@/lib/cn";

interface Measurement {
  id: string;
  measuredOn: string;
  weightKg: number | null;
  heightCm: number | null;
  headCm: number | null;
}

/**
 * ส่วนเสริมใต้ timeline — ทุกอันพับไว้ก่อน
 *
 * คนส่วนใหญ่เปิดหน้านี้มาดูรูป ไม่ได้มากรอกน้ำหนัก ถ้ากางทุกอย่างไว้ตั้งแต่แรก
 * รูปจะถูกดันลงไปจนต้องเลื่อนหา ซึ่งทำให้ฟีเจอร์หลักแย่ลงเพื่อฟีเจอร์รอง
 */
export function ChildExtras({
  child,
  measurements,
  milestones,
  canWrite,
}: {
  child: { id: string; name: string; birthDate: string };
  measurements: Measurement[];
  milestones: { kind: MilestoneKind; achievedOn: string }[];
  canWrite: boolean;
}) {
  const done = new Map(milestones.map((m) => [m.kind, m.achievedOn]));

  return (
    <div className="flex flex-col gap-2">
      <Section title="น้ำหนักและส่วนสูง" count={measurements.length}>
        <MeasurementPanel
          childId={child.id}
          birthDate={child.birthDate}
          rows={measurements}
          canWrite={canWrite}
        />
      </Section>

      <Section title="หมุดพัฒนาการ" count={done.size} total={MILESTONES.length}>
        <MilestonePanel childId={child.id} done={done} canWrite={canWrite} />
      </Section>

      {canWrite && (
        <Section title="แก้ชื่อหรือวันเกิด">
          <ChildForm child={child} />
        </Section>
      )}
    </div>
  );
}

function Section({
  title,
  count,
  total,
  children,
}: {
  title: string;
  count?: number;
  total?: number;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Card className="flex flex-col gap-3 p-0">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between gap-2 px-4 py-3 text-left"
      >
        <span className="font-medium text-ink-900">{title}</span>
        <span className="flex items-center gap-2 text-[13px] text-ink-600">
          {count != null && (
            <span className="tabular-nums">{total != null ? `${count}/${total}` : count}</span>
          )}
          <ChevronDown
            size={17}
            className={cn("text-ink-400 transition-transform", open && "rotate-180")}
            aria-hidden
          />
        </span>
      </button>
      {open && <div className="flex flex-col gap-3 px-4 pb-4">{children}</div>}
    </Card>
  );
}

/** ตัวเลขจากช่องกรอก — ว่างคือ "ไม่ได้วัด" ไม่ใช่ศูนย์ */
const num = (v: string) => (v.trim() === "" ? null : Number(v));

function MeasurementPanel({
  childId,
  birthDate,
  rows,
  canWrite,
}: {
  childId: string;
  birthDate: string;
  rows: Measurement[];
  canWrite: boolean;
}) {
  const router = useRouter();
  const [on, setOn] = useState(localToday());
  const [w, setW] = useState("");
  const [h, setH] = useState("");
  const save = useAction(saveMeasurement, {
    onSuccess: () => {
      setW("");
      setH("");
      router.refresh();
    },
  });
  const err = save.result?.serverError ?? save.result?.validationErrors?._errors?.[0];

  return (
    <>
      {rows.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {rows.map((r) => (
            <li key={r.id} className="flex items-baseline justify-between gap-2 text-[13px]">
              <span className="text-ink-600">
                {ageLabel(birthDate, r.measuredOn)}
                <span className="ml-1.5 text-ink-400">{r.measuredOn}</span>
              </span>
              <span className="tabular-nums text-ink-900">
                {[
                  r.weightKg != null && `${r.weightKg} กก.`,
                  r.heightCm != null && `${r.heightCm} ซม.`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </span>
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <form
          className="flex flex-col gap-2 border-t border-cream-200 pt-3"
          onSubmit={(e) => {
            e.preventDefault();
            save.execute({
              childId,
              measuredOn: on,
              weightKg: num(w),
              heightCm: num(h),
            });
          }}
        >
          <Field label="วันที่ชั่ง" type="date" value={on} max={localToday()}
            onChange={(e) => setOn(e.target.value)} required />
          <div className="grid grid-cols-2 gap-2">
            <Field label="น้ำหนัก" type="number" step="0.01" inputMode="decimal" suffix="กก."
              value={w} onChange={(e) => setW(e.target.value)} />
            <Field label="ส่วนสูง" type="number" step="0.1" inputMode="decimal" suffix="ซม."
              value={h} onChange={(e) => setH(e.target.value)} />
          </div>
          {err && <p className="text-sm text-danger">{err}</p>}
          <Button type="submit" variant="secondary" disabled={save.isPending || (!w && !h)}>
            {save.isPending ? "กำลังบันทึก…" : "บันทึก"}
          </Button>
          {/* บอกไว้ตรงนี้ ไม่ใช่ตอนกดบันทึกแล้วเจอกราฟที่ไม่มี */}
          <p className="text-xs text-ink-400">
            เก็บไว้ดูย้อนหลัง ยังไม่ได้เทียบกับเกณฑ์การเจริญเติบโต
          </p>
        </form>
      )}
    </>
  );
}

function MilestonePanel({
  childId,
  done,
  canWrite,
}: {
  childId: string;
  done: Map<MilestoneKind, string>;
  canWrite: boolean;
}) {
  const router = useRouter();
  const set = useAction(setMilestone, { onSuccess: () => router.refresh() });
  const clear = useAction(clearMilestone, { onSuccess: () => router.refresh() });

  return (
    <ul className="flex flex-col gap-1">
      {MILESTONES.map((m) => {
        const at = done.get(m.kind);
        return (
          <li key={m.kind}>
            <button
              type="button"
              disabled={!canWrite || set.isPending || clear.isPending}
              aria-pressed={Boolean(at)}
              onClick={() =>
                at
                  ? clear.execute({ childId, kind: m.kind })
                  : set.execute({ childId, kind: m.kind, achievedOn: localToday() })
              }
              className="flex w-full items-center gap-2.5 rounded-md py-2 text-left disabled:opacity-60"
            >
              <span
                className={cn(
                  "flex size-5 shrink-0 items-center justify-center rounded-full border",
                  at ? "border-sage-600 bg-sage-600 text-white" : "border-cream-200 bg-white",
                )}
              >
                {at && <Check size={13} strokeWidth={3} aria-hidden />}
              </span>
              <span className="flex-1 text-sm text-ink-900">{m.label}</span>
              <span className="text-xs tabular-nums text-ink-400">
                {at ?? `มักราว ${m.typicalMonths[0]}–${m.typicalMonths[1]} เดือน`}
              </span>
            </button>
          </li>
        );
      })}
      <li className="pt-1 text-xs leading-relaxed text-ink-400">
        ช่วงอายุที่เขียนไว้เป็นค่าที่พบบ่อย เด็กปกติเร็วช้ากว่านี้ได้มาก
        ไม่ใช่เกณฑ์ตัดสินพัฒนาการ
      </li>
    </ul>
  );
}
