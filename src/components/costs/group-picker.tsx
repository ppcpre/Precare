"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { GroupDot } from "@/components/costs/bits";
import { createCareGroup } from "@/actions/costs";
import { cn } from "@/lib/cn";

export type CareGroupOption = { id: string; name: string; color: string };

/**
 * เลือกกลุ่มการรักษาตอนสร้าง/แก้นัดหมาย
 *
 * เลือกตรงนี้ทีเดียว ยอดค่าใช้จ่ายจึงแยกเรื่องได้เลย ไม่ต้องไปไล่จัดกลุ่มทีหลัง
 * ไม่บังคับเลือก ไม่เลือกก็ไปอยู่ "ทั่วไป" เพราะคนส่วนใหญ่มีเรื่องเดียว
 * การบังคับเลือกจะเพิ่มขั้นตอนให้ทุกคนเพื่อประโยชน์ของคนส่วนน้อย
 */
export function GroupPicker({
  groups: initial,
  value,
  onChange,
}: {
  groups: CareGroupOption[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const [groups, setGroups] = useState(initial);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");

  const { execute, isPending, result } = useAction(createCareGroup, {
    onSuccess: ({ data }) => {
      if (!data) return;
      // เพิ่มเข้า list เองเลย ไม่ต้อง refresh ทั้งหน้า ไม่งั้นที่กรอกค้างไว้หาย
      setGroups((cur) => [...cur, { id: data.id, name: data.name, color: "sky" }]);
      onChange(data.id);
      setName("");
      setAdding(false);
    },
  });

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm text-ink-600">กลุ่มการรักษา</span>

      <div className="flex flex-wrap gap-1.5">
        {groups.map((g) => {
          const on = g.id === value;
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              onClick={() => onChange(on ? null : g.id)}
              className={cn(
                "inline-flex h-auto min-h-0 items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-sm",
                on ? "border-brown-100 bg-brown-100 text-brown-900" : "border-cream-200 bg-white text-ink-600",
              )}
            >
              <GroupDot color={g.color} />
              {g.name}
            </button>
          );
        })}

        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex h-auto min-h-0 items-center gap-1.5 rounded-full border border-dashed border-brown-300 bg-white px-3.5 py-1.5 text-sm text-brown-700"
          >
            <Plus size={14} strokeWidth={2} />
            กลุ่มใหม่
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-2">
          <input
            autoFocus
            value={name}
            maxLength={40}
            placeholder="เช่น ทันตกรรม"
            aria-label="ชื่อกลุ่มใหม่"
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) {
                e.preventDefault();
                execute({ name: name.trim(), color: "sky" });
              }
              if (e.key === "Escape") setAdding(false);
            }}
            className="h-11 flex-1 rounded-sm border border-cream-200 bg-cream-50 px-3 text-base text-ink-900 placeholder:text-ink-400 focus:border-[1.5px] focus:border-brown-500 focus:outline-none"
          />
          <button
            type="button"
            disabled={!name.trim() || isPending}
            onClick={() => execute({ name: name.trim(), color: "sky" })}
            className="h-11 shrink-0 rounded-sm bg-brown-700 px-4 text-sm font-medium text-white disabled:bg-cream-200 disabled:text-ink-400"
          >
            เพิ่ม
          </button>
        </div>
      )}

      {result.serverError && <p className="text-xs text-danger">{result.serverError}</p>}

      <p className="text-xs text-ink-400">
        ใช้แยกยอดค่าใช้จ่ายตามเรื่องที่รักษา ไม่เลือกก็ได้ จะไปอยู่กลุ่ม ทั่วไป
      </p>
    </div>
  );
}
