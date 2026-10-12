"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Pencil, Plus, Power, Trash2, X } from "lucide-react";
import { addMedication, deleteMedication, updateMedication } from "@/actions/medications";
import { MAX_MED_TIMES } from "@/db/schema";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/cn";
import { thaiDate } from "@/lib/format";

export interface MedRow {
  id: string;
  name: string;
  dose: string | null;
  note: string | null;
  startOn: string;
  endOn: string | null;
  active: boolean;
  times: string[];
}

const EMPTY = { name: "", dose: "", note: "", endOn: "", times: ["08:00"] };

/**
 * เพิ่ม/แก้รายการยา — ฟอร์มเดียวใช้ทั้งสองอย่าง
 *
 * แยกจากรายการของวันนี้ เพราะสองอย่างนี้ทำคนละจังหวะ: ตั้งยาทำครั้งเดียว
 * ตอนหมอสั่ง ส่วนติ๊กว่ากินแล้วทำทุกวัน การเอามารวมกันทำให้หน้าที่ใช้ทุกวันรก
 */
export function MedicationForm({ meds, today }: { meds: MedRow[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [f, setF] = useState(EMPTY);
  const [startOn, setStartOn] = useState(today);

  const done = () => {
    setOpen(false);
    setEditing(null);
    setF(EMPTY);
    setStartOn(today);
    router.refresh();
  };

  const add = useAction(addMedication, { onSuccess: done });
  const upd = useAction(updateMedication, { onSuccess: done });
  const del = useAction(deleteMedication, { onSuccess: () => router.refresh() });
  const err = add.result.serverError ?? upd.result.serverError ?? del.result.serverError;
  const busy = add.isPending || upd.isPending;

  const startEdit = (m: MedRow) => {
    setEditing(m.id);
    setOpen(true);
    setF({
      name: m.name,
      dose: m.dose ?? "",
      note: m.note ?? "",
      endOn: m.endOn ?? "",
      times: m.times.length ? m.times : ["08:00"],
    });
    setStartOn(m.startOn);
  };

  const submit = () => {
    const payload = {
      name: f.name,
      dose: f.dose || null,
      note: f.note || null,
      startOn,
      endOn: f.endOn || null,
      times: f.times,
    };
    if (editing) upd.execute({ id: editing, ...payload });
    else add.execute(payload);
  };

  const setTime = (i: number, v: string) =>
    setF((p) => ({ ...p, times: p.times.map((t, idx) => (idx === i ? v : t)) }));

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-medium text-ink-900">รายการที่ตั้งไว้</h2>
        {!open && (
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="flex min-h-11 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium text-brown-700 hover:bg-cream-100"
          >
            <Plus size={17} strokeWidth={2} />
            เพิ่มรายการ
          </button>
        )}
      </div>

      {meds.length === 0 && !open && (
        <p className="text-[13px] text-ink-600">ยังไม่มีรายการยาหรือวิตามิน</p>
      )}

      {meds.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {meds.map((m) => (
            <li
              key={m.id}
              className={cn(
                "flex items-center gap-2 rounded-sm px-3 py-2",
                m.active ? "bg-cream-50" : "bg-cream-100 opacity-60",
              )}
            >
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] text-ink-900">{m.name}</span>
                  {m.dose && <span className="shrink-0 text-[11px] text-ink-400">{m.dose}</span>}
                  {!m.active && <span className="shrink-0 text-[10px] text-ink-400">หยุดไว้</span>}
                </span>
                <span className="text-[11px] text-ink-600">
                  {m.times.join(" · ")}
                  {m.endOn ? ` · ถึง ${thaiDate(m.endOn)}` : " · ไม่มีกำหนดจบ"}
                </span>
              </span>

              <button
                type="button"
                aria-label={`${m.active ? "หยุดเตือน" : "เปิดเตือน"} ${m.name}`}
                onClick={() =>
                  upd.execute({
                    id: m.id,
                    name: m.name,
                    dose: m.dose,
                    note: m.note,
                    startOn: m.startOn,
                    endOn: m.endOn,
                    times: m.times,
                    active: !m.active,
                  })
                }
                className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400"
              >
                <Power size={16} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                aria-label={`แก้ ${m.name}`}
                onClick={() => startEdit(m)}
                className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400"
              >
                <Pencil size={15} strokeWidth={1.9} />
              </button>
              <button
                type="button"
                aria-label={`ลบ ${m.name}`}
                onClick={() => {
                  // ลบแล้วประวัติว่ากินแล้วหายไปด้วย ย้อนกลับไม่ได้ ต้องถามก่อน
                  if (confirm(`ลบ ${m.name} และประวัติการกินทั้งหมด?`)) del.execute({ id: m.id });
                }}
                className="flex size-11 shrink-0 items-center justify-center rounded-sm text-danger"
              >
                <Trash2 size={16} strokeWidth={1.8} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && (
        <div className="flex flex-col gap-3 border-t border-cream-200 pt-3">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-ink-900">
              {editing ? "แก้รายการ" : "เพิ่มรายการใหม่"}
            </span>
            <button
              type="button"
              aria-label="ปิดฟอร์ม"
              onClick={() => {
                setOpen(false);
                setEditing(null);
                setF(EMPTY);
              }}
              className="flex size-11 items-center justify-center rounded-full text-ink-400"
            >
              <X size={18} strokeWidth={2} />
            </button>
          </div>

          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] text-ink-600">ชื่อยา/วิตามิน</span>
              <input
                value={f.name}
                onChange={(e) => setF((p) => ({ ...p, name: e.target.value }))}
                placeholder="เช่น โฟลิก"
                className="h-11 w-full rounded-sm border border-cream-200 bg-white px-3 text-base text-ink-900 placeholder:text-ink-400"
              />
            </label>
            <label className="flex w-28 shrink-0 flex-col gap-1">
              <span className="text-[11px] text-ink-600">ปริมาณ</span>
              <input
                value={f.dose}
                onChange={(e) => setF((p) => ({ ...p, dose: e.target.value }))}
                placeholder="1 เม็ด"
                className="h-11 w-full rounded-sm border border-cream-200 bg-white px-3 text-base text-ink-900 placeholder:text-ink-400"
              />
            </label>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-[11px] text-ink-600">เวลาที่ต้องกิน</span>
            <div className="flex flex-wrap gap-1.5">
              {f.times.map((t, i) => (
                <span key={i} className="flex items-center gap-1">
                  <label className="flex min-h-11 items-center">
                    <span className="sr-only">เวลาครั้งที่ {i + 1}</span>
                    <input
                      type="time"
                      value={t}
                      onChange={(e) => setTime(i, e.target.value)}
                      className="h-11 rounded-sm border border-cream-200 bg-white px-2 text-[13px] text-ink-900"
                    />
                  </label>
                  {f.times.length > 1 && (
                    <button
                      type="button"
                      aria-label={`เอาเวลาครั้งที่ ${i + 1} ออก`}
                      onClick={() =>
                        setF((p) => ({ ...p, times: p.times.filter((_, idx) => idx !== i) }))
                      }
                      className="flex size-11 items-center justify-center rounded-full text-ink-400"
                    >
                      <X size={15} strokeWidth={2} />
                    </button>
                  )}
                </span>
              ))}
              {f.times.length < MAX_MED_TIMES && (
                <button
                  type="button"
                  onClick={() => setF((p) => ({ ...p, times: [...p.times, "20:00"] }))}
                  className="flex min-h-11 items-center gap-1 rounded-md border border-cream-200 bg-white px-3 text-[13px] text-ink-600"
                >
                  <Plus size={15} strokeWidth={2} />
                  เพิ่มเวลา
                </button>
              )}
            </div>
          </div>

          <div className="flex gap-2">
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] text-ink-600">เริ่มวันที่</span>
              <input
                type="date"
                value={startOn}
                onChange={(e) => setStartOn(e.target.value)}
                className="h-11 w-full rounded-sm border border-cream-200 bg-white px-2 text-[13px] text-ink-900"
              />
            </label>
            <label className="flex min-w-0 flex-1 flex-col gap-1">
              <span className="text-[11px] text-ink-600">ถึงวันที่ (เว้นว่างได้)</span>
              <input
                type="date"
                value={f.endOn}
                min={startOn}
                onChange={(e) => setF((p) => ({ ...p, endOn: e.target.value }))}
                className="h-11 w-full rounded-sm border border-cream-200 bg-white px-2 text-[13px] text-ink-900"
              />
            </label>
          </div>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] text-ink-600">โน้ต (เว้นว่างได้)</span>
            <input
              value={f.note}
              onChange={(e) => setF((p) => ({ ...p, note: e.target.value }))}
              placeholder="เช่น กินหลังอาหาร"
              className="h-11 w-full rounded-sm border border-cream-200 bg-white px-3 text-base text-ink-900 placeholder:text-ink-400"
            />
          </label>

          {err && <p className="text-xs text-danger">{err}</p>}

          <button
            type="button"
            disabled={busy || f.name.trim() === ""}
            onClick={submit}
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-brown-700 text-sm font-semibold text-white disabled:opacity-40"
          >
            {editing ? "บันทึกการแก้ไข" : "เพิ่มรายการ"}
          </button>
        </div>
      )}
    </Card>
  );
}
