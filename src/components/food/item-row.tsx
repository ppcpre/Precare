"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Check, Pencil, Trash2, X } from "lucide-react";
import { deleteFoodLog, updateFoodLog } from "@/actions/food";

export interface FoodItem {
  id: string;
  name: string;
  portion: string | null;
  kcal: number | null;
  carbG: number | null;
  sugarG: number | null;
  proteinG: number | null;
  source: "ai" | "user";
}

const FIELDS = [
  { key: "kcal", label: "พลังงาน", unit: "kcal" },
  { key: "carbG", label: "คาร์บ", unit: "ก." },
  { key: "sugarG", label: "น้ำตาล", unit: "ก." },
  { key: "proteinG", label: "โปรตีน", unit: "ก." },
] as const;

type Nums = Record<(typeof FIELDS)[number]["key"], string>;
const toStr = (v: number | null) => (v == null ? "" : String(v));
const toInt = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

/**
 * รายการอาหารหนึ่งรายการ — แก้ตัวเลขทีหลังได้ ไม่ใช่แค่ลบ
 *
 * ต้องแก้ได้เพราะเลขที่ AI ประมาณให้ผิดได้ และคนมักรู้ว่าผิดหลังกดบันทึกไปแล้ว
 * ถ้าแก้ไม่ได้ ทางเดียวคือลบแล้วพิมพ์ใหม่ทั้งรายการ ซึ่งคนจะเลือกปล่อยเลขผิดไว้
 * แล้วยอดรวมทั้งวันก็ผิดตามไปตลอด
 */
export function FoodItemRow({ item, canWrite }: { item: FoodItem; canWrite: boolean }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [nums, setNums] = useState<Nums>({
    kcal: toStr(item.kcal),
    carbG: toStr(item.carbG),
    sugarG: toStr(item.sugarG),
    proteinG: toStr(item.proteinG),
  });

  const del = useAction(deleteFoodLog, { onSuccess: () => router.refresh() });
  const save = useAction(updateFoodLog, {
    onSuccess: () => {
      setEditing(false);
      router.refresh();
    },
  });

  const empty = item.kcal == null && item.carbG == null && item.proteinG == null;
  const err = save.result.serverError ?? del.result.serverError;

  return (
    <div className="flex flex-col gap-2 rounded-sm bg-cream-50 px-3 py-2">
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[13px] text-ink-900">{item.name}</span>
            {item.portion && (
              <span className="shrink-0 text-[11px] text-ink-400">{item.portion}</span>
            )}
            {item.source === "ai" && <span className="shrink-0 text-[10px] text-warning">AI</span>}
          </span>
          <span className="text-[11px] text-ink-600">
            {empty
              ? "ยังไม่มีตัวเลข"
              : `คาร์บ ${item.carbG ?? "—"} · น้ำตาล ${item.sugarG ?? "—"} · โปรตีน ${item.proteinG ?? "—"} ก.`}
          </span>
        </div>
        <b className="shrink-0 text-[13px] text-ink-900">
          {item.kcal == null ? "—" : item.kcal.toLocaleString("th-TH")}
        </b>
        {canWrite && (
          <>
            <button
              type="button"
              aria-label={editing ? `ยกเลิกการแก้ ${item.name}` : `แก้ตัวเลขของ ${item.name}`}
              onClick={() => setEditing((v) => !v)}
              className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400"
            >
              {editing ? <X size={16} strokeWidth={2} /> : <Pencil size={15} strokeWidth={1.9} />}
            </button>
            <button
              type="button"
              disabled={del.isPending}
              aria-label={`ลบ ${item.name}`}
              onClick={() => {
                // กดพลาดแล้วต้องพิมพ์ใหม่ทั้งรายการ จึงถามก่อน
                if (confirm(`ลบ ${item.name} ออกจากรายการวันนี้?`)) del.execute({ id: item.id });
              }}
              className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400 disabled:opacity-40"
            >
              <Trash2 size={16} strokeWidth={1.8} />
            </button>
          </>
        )}
      </div>

      {editing && (
        <div className="flex flex-col gap-2 border-t border-cream-200 pt-2">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map((f) => (
              <label key={f.key} className="flex flex-col gap-1">
                <span className="text-[11px] text-ink-600">{f.label}</span>
                <span className="flex items-center gap-1 rounded-sm border border-cream-200 bg-white px-2.5">
                  <input
                    inputMode="numeric"
                    value={nums[f.key]}
                    onChange={(e) =>
                      setNums((p) => ({ ...p, [f.key]: e.target.value.replace(/[^\d]/g, "") }))
                    }
                    aria-label={`${f.label} ของ ${item.name}`}
                    className="h-11 w-full min-w-0 bg-transparent text-base text-ink-900 focus:outline-none"
                  />
                  <span className="shrink-0 text-[11px] text-ink-400">{f.unit}</span>
                </span>
              </label>
            ))}
          </div>
          <button
            type="button"
            disabled={save.isPending}
            onClick={() =>
              save.execute({
                id: item.id,
                kcal: toInt(nums.kcal),
                carbG: toInt(nums.carbG),
                sugarG: toInt(nums.sugarG),
                proteinG: toInt(nums.proteinG),
              })
            }
            className="flex h-11 items-center justify-center gap-2 rounded-md bg-brown-700 text-sm font-semibold text-white disabled:opacity-40"
          >
            <Check size={17} strokeWidth={2.2} />
            บันทึกตัวเลขใหม่
          </button>
        </div>
      )}

      {err && <p className="text-[11px] text-danger">{err}</p>}
    </div>
  );
}
