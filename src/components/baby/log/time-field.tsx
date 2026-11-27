"use client";

import { useState } from "react";
import { ChevronRight, Clock } from "lucide-react";

/**
 * เวลา `HH:MM` → เวลาเต็มที่ไม่ล้ำปัจจุบัน
 * ถ้าเวลาที่เลือกยังมาไม่ถึงในวันนี้ ถือว่าเป็นของเมื่อคืน (ให้นมตอนตีสามแล้วมาจดตอนเช้า)
 */
export function atFromTime(hhmm: string, nowIso: string): string {
  const today = nowIso.slice(0, 10);
  const candidate = `${today}T${hhmm}:00`;
  if (candidate <= nowIso) return candidate;
  const d = new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  return `${d}T${hhmm}:00`;
}

/**
 * แถว "เวลา · ตอนนี้ 14:35 >" — แตะแล้วเปลี่ยนเป็นช่องเลือกเวลา
 * value = null แปลว่าใช้เวลาตอนกดบันทึก
 */
export function TimeField({
  label = "เวลา",
  value,
  onChange,
  nowIso,
}: {
  label?: string;
  value: string | null;
  onChange: (hhmm: string | null) => void;
  nowIso: string;
}) {
  const [editing, setEditing] = useState(false);
  const shown = value ?? nowIso.slice(11, 16);

  return (
    <div className="flex min-h-11 items-center justify-between gap-3 rounded-md border border-cream-200 px-3">
      <span className="flex items-center gap-2 text-sm text-ink-600">
        <Clock size={16} strokeWidth={1.9} className="text-ink-400" />
        {label}
      </span>
      {editing ? (
        <input
          type="time"
          aria-label={label}
          autoFocus
          value={shown}
          onChange={(e) => onChange(e.target.value || null)}
          onBlur={() => setEditing(false)}
          className="h-9 rounded-sm border border-cream-300 px-2 text-base tabular-nums text-ink-900"
        />
      ) : (
        <button
          type="button"
          onClick={() => setEditing(true)}
          className="flex h-11 items-center gap-1 text-[15px] font-medium tabular-nums text-ink-900"
        >
          {value ? value : `ตอนนี้ ${shown}`}
          <ChevronRight size={16} className="text-ink-400" />
        </button>
      )}
    </div>
  );
}
