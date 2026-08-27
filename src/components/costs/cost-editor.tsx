"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { GroupTag } from "@/components/costs/bits";
import { saveCosts } from "@/actions/costs";
import { formatBaht, parseBaht } from "@/lib/money";
import { thaiDate } from "@/lib/format";
import { cn } from "@/lib/cn";
import type { ClaimStatus } from "@/db/schema";
import type { CostItem } from "@/lib/costs";

const CLAIM_LABEL: Record<ClaimStatus, string> = {
  none: "ยังไม่เบิก",
  done: "เบิกแล้ว",
  no: "เบิกไม่ได้",
};
const CLAIM_ORDER: ClaimStatus[] = ["none", "done", "no"];

type Draft = { amount: string; claim: ClaimStatus };

/**
 * กรอกค่าใช้จ่ายหลายนัดแล้วบันทึกทีเดียว
 *
 * เก็บค่าที่พิมพ์เป็น "ข้อความ" ไม่ใช่ตัวเลข จนกว่าจะกดบันทึก
 * เพราะระหว่างพิมพ์ "1200." หรือ "1,2" ยังไม่เป็นตัวเลขที่ถูกต้อง
 * ถ้าแปลงทันทีทุกครั้งที่พิมพ์ เคอร์เซอร์จะกระโดดและลบตัวอักษรที่กำลังพิมพ์ทิ้ง
 */
export function CostEditor({ items, canEdit }: { items: CostItem[]; canEdit: boolean }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Record<string, Draft>>(() =>
    Object.fromEntries(
      items.map((i) => [
        i.id,
        { amount: i.costSatang == null ? "" : formatBaht(i.costSatang), claim: i.claimStatus },
      ]),
    ),
  );

  const { execute, isPending, result } = useAction(saveCosts, {
    onSuccess: () => router.refresh(),
  });

  const invalid = useMemo(
    () => Object.entries(draft).filter(([, d]) => parseBaht(d.amount) === undefined).map(([id]) => id),
    [draft],
  );

  const dirty = useMemo(
    () =>
      items.some((i) => {
        const d = draft[i.id];
        if (!d) return false;
        const parsed = parseBaht(d.amount);
        return parsed !== i.costSatang || d.claim !== i.claimStatus;
      }),
    [draft, items],
  );

  // นับเฉพาะช่องที่กรอกเป็นตัวเลขแล้ว และจำไว้ว่ามีสักช่องไหม
  // ถ้ายังไม่มีเลย ต้องขึ้น "ยังไม่ระบุ" ไม่ใช่ ฿0 เพราะ ฿0 อ่านได้ว่าไม่เสียเงิน
  const { runningTotal, filled } = items.reduce(
    (acc, i) => {
      const p = parseBaht(draft[i.id]?.amount ?? "");
      return typeof p === "number"
        ? { runningTotal: acc.runningTotal + p, filled: acc.filled + 1 }
        : acc;
    },
    { runningTotal: 0, filled: 0 },
  );

  function submit() {
    if (invalid.length) return;
    execute({
      rows: items.map((i) => ({
        id: i.id,
        costSatang: parseBaht(draft[i.id].amount) as number | null,
        claimStatus: draft[i.id].claim,
      })),
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {result.serverError && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          {result.serverError}
        </p>
      )}

      {items.map((it) => {
        const d = draft[it.id];
        const bad = parseBaht(d.amount) === undefined;
        return (
          <div
            key={it.id}
            className="flex flex-col gap-2.5 rounded-md border border-cream-200 bg-white p-3 shadow-[var(--shadow-card)]"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex min-w-0 flex-col gap-1">
                <span className="truncate text-[15px] font-medium text-ink-900">
                  {it.title || "นัดหมาย"}
                </span>
                <span className="flex flex-wrap items-center gap-1.5">
                  <GroupTag name={it.groupName ?? "ทั่วไป"} color={it.groupColor} />
                  <span className="text-xs text-ink-400">{thaiDate(it.apptDatetime)}</span>
                  {it.location && <span className="truncate text-xs text-ink-400">{it.location}</span>}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <label className="flex flex-1 items-center gap-1.5 rounded-sm border bg-cream-50 px-2.5 has-[input:focus]:border-[1.5px] has-[input:focus]:border-brown-500"
                     style={{ borderColor: bad ? "var(--color-danger)" : undefined }}>
                <span className="text-sm text-ink-400">฿</span>
                <input
                  inputMode="decimal"
                  disabled={!canEdit}
                  aria-label={`ค่าใช้จ่าย ${it.title || "นัดหมาย"}`}
                  aria-invalid={bad}
                  value={d.amount}
                  placeholder="ยังไม่ระบุ"
                  onChange={(e) =>
                    setDraft((cur) => ({ ...cur, [it.id]: { ...cur[it.id], amount: e.target.value } }))
                  }
                  className="h-10 w-full min-w-0 bg-transparent text-right text-[15px] tabular-nums text-ink-900 placeholder:text-ink-400 focus:outline-none disabled:text-ink-600"
                />
              </label>

              {/* วนสถานะด้วยปุ่มเดียว แทน dropdown — มีแค่ 3 ค่าและแตะง่ายกว่าบนมือถือ */}
              <button
                type="button"
                disabled={!canEdit}
                onClick={() =>
                  setDraft((cur) => ({
                    ...cur,
                    [it.id]: {
                      ...cur[it.id],
                      claim: CLAIM_ORDER[(CLAIM_ORDER.indexOf(cur[it.id].claim) + 1) % 3],
                    },
                  }))
                }
                className={cn(
                  "h-10 shrink-0 rounded-full px-3 text-xs",
                  d.claim === "done" && "bg-sage-100 text-sage-700",
                  d.claim === "none" && "bg-cream-200 text-ink-600",
                  d.claim === "no" && "bg-cream-100 text-ink-400",
                )}
              >
                {CLAIM_LABEL[d.claim]}
              </button>
            </div>

            {bad && <p className="text-xs text-danger">กรอกเป็นตัวเลข เช่น 1200 หรือ 1200.50</p>}
          </div>
        );
      })}

      {canEdit && (
        <div className="sticky bottom-0 -mx-4 flex flex-col gap-2.5 border-t border-cream-200 bg-white px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600">รวมที่ระบุแล้ว</span>
            {filled === 0 ? (
              <span className="text-base font-medium text-warning">ยังไม่ระบุ</span>
            ) : (
              <span className="text-xl font-semibold tabular-nums text-ink-900">
                ฿{formatBaht(runningTotal)}
              </span>
            )}
          </div>
          <Button full loading={isPending} disabled={!dirty || invalid.length > 0} onClick={submit}>
            บันทึก
          </Button>
        </div>
      )}
    </div>
  );
}
