"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Plus, Sparkles } from "lucide-react";
import { addFoodLog, estimateFood } from "@/actions/food";
import { SLOT_LABEL } from "@/lib/nutrition";
import { MEAL_SLOTS, type MealSlot } from "@/db/schema";
import { cn } from "@/lib/cn";

export interface RecentFood {
  name: string;
  portion: string | null;
  kcal: number | null;
  carbG: number | null;
  sugarG: number | null;
  proteinG: number | null;
}

type Nums = { kcal: string; carbG: string; sugarG: string; proteinG: string };
const EMPTY: Nums = { kcal: "", carbG: "", sugarG: "", proteinG: "" };
const toInt = (v: string) => (v.trim() === "" ? null : Math.round(Number(v)));

/**
 * เพิ่มเมนู — พิมพ์ชื่อ → ให้ AI ประมาณ → แก้ได้ → บันทึก
 *
 * AI เป็นตัวช่วยกรอก ไม่ใช่ตัวตัดสิน ทุกช่องแก้ได้และบันทึกได้แม้ไม่มีตัวเลขเลย
 * (บทเรียนจากการอ่านใบเสร็จ: โมเดลตอบผิดแบบมั่นใจและผิดซ้ำเดิมทุกครั้ง)
 */
export function FoodForm({
  slot: initialSlot,
  recent,
  eatenOn,
  isToday,
}: {
  slot: MealSlot;
  recent: RecentFood[];
  /** วันของบันทึก — ส่งมาเสมอ เพื่อให้วันย้อนหลังลงวันถูก ไม่ใช่ลงวันนี้ */
  eatenOn: string;
  isToday: boolean;
}) {
  const router = useRouter();
  const [slot, setSlot] = useState<MealSlot>(initialSlot);
  const [name, setName] = useState("");
  const [portion, setPortion] = useState("");
  const [nums, setNums] = useState<Nums>(EMPTY);
  const [basis, setBasis] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [fromAi, setFromAi] = useState(false);

  const est = useAction(estimateFood, {
    onSuccess: ({ data }) => {
      if (data?.status === "read") {
        const v = data.value;
        setNums({
          kcal: String(v.kcal),
          carbG: String(v.carbG),
          sugarG: String(v.sugarG),
          proteinG: String(v.proteinG),
        });
        setBasis(v.basis);
        setFromAi(true);
        setNote(null);
      } else {
        // อ่านไม่ได้ไม่ใช่ทางตัน — กรอกเองได้
        setBasis(null);
        setFromAi(false);
        setNote(
          data?.status === "unavailable"
            ? "ตอนนี้ให้ AI ช่วยไม่ได้ กรอกตัวเลขเองหรือเว้นว่างไว้ก่อนได้"
            : "ไม่รู้จักเมนูนี้ กรอกตัวเลขเองหรือเว้นว่างไว้ก่อนได้",
        );
      }
    },
  });

  const add = useAction(addFoodLog, {
    onSuccess: () => {
      setName("");
      setPortion("");
      setNums(EMPTY);
      setBasis(null);
      setNote(null);
      setFromAi(false);
      router.refresh();
    },
  });

  const fillFromRecent = (r: RecentFood) => {
    setName(r.name);
    setPortion(r.portion ?? "");
    setNums({
      kcal: r.kcal == null ? "" : String(r.kcal),
      carbG: r.carbG == null ? "" : String(r.carbG),
      sugarG: r.sugarG == null ? "" : String(r.sugarG),
      proteinG: r.proteinG == null ? "" : String(r.proteinG),
    });
    // ค่าที่ยืนยันแล้วจากครั้งก่อน ไม่ต้องให้ AI เดาใหม่ — ประหยัดโควตา
    // และได้เลขเท่าเดิมทุกครั้ง ซึ่งสำคัญกว่าความแม่นยำเพราะสิ่งที่ดูคือแนวโน้ม
    setBasis("ใช้ค่าที่เคยบันทึกไว้");
    setFromAi(false);
    setNote(null);
  };

  const field = (key: keyof Nums, label: string, unit: string) => (
    <label className="flex flex-1 flex-col gap-1">
      <span className="text-[11px] text-ink-600">{label}</span>
      <span className="flex items-center gap-1 rounded-sm border border-cream-200 bg-white px-2.5">
        <input
          inputMode="numeric"
          value={nums[key]}
          onChange={(e) => setNums((p) => ({ ...p, [key]: e.target.value.replace(/[^\d]/g, "") }))}
          aria-label={label}
          className="h-11 w-full min-w-0 bg-transparent text-base text-ink-900 focus:outline-none"
        />
        <span className="shrink-0 text-[11px] text-ink-400">{unit}</span>
      </span>
    </label>
  );

  const err = est.result.serverError ?? add.result.serverError;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {MEAL_SLOTS.map((s) => (
          <button
            key={s}
            type="button"
            aria-pressed={s === slot}
            onClick={() => setSlot(s)}
            className={cn(
              "h-11 flex-1 rounded-md text-sm",
              s === slot
                ? "bg-brown-700 font-medium text-white"
                : "border border-cream-200 bg-white text-ink-600",
            )}
          >
            {SLOT_LABEL[s]}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="เช่น ข้าวมันไก่"
          aria-label="ชื่อเมนู"
          className="h-11 min-w-0 flex-1 rounded-sm border border-cream-200 bg-white px-3 text-base text-ink-900 placeholder:text-ink-400"
        />
        <input
          value={portion}
          onChange={(e) => setPortion(e.target.value)}
          placeholder="1 จาน"
          aria-label="ปริมาณ"
          className="h-11 w-24 shrink-0 rounded-sm border border-cream-200 bg-white px-3 text-center text-base text-ink-900 placeholder:text-ink-400"
        />
      </div>

      {recent.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] text-ink-400">เคยกิน:</span>
          {recent.map((r) => (
            <button
              key={`${r.name}|${r.portion ?? ""}`}
              type="button"
              onClick={() => fillFromRecent(r)}
              className="min-h-11 rounded-full border border-cream-200 bg-white px-3 text-[13px] text-ink-600"
            >
              {r.name}
            </button>
          ))}
        </div>
      )}

      <button
        type="button"
        disabled={est.isPending || name.trim() === ""}
        onClick={() => est.execute({ name, portion: portion || null })}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-cream-200 bg-white text-sm font-medium text-brown-700 disabled:opacity-40"
      >
        <Sparkles size={16} strokeWidth={1.9} />
        {est.isPending ? "กำลังประมาณ…" : "ให้ AI ประมาณให้"}
      </button>

      <div className="flex flex-col gap-2">
        <div className="flex gap-2">
          {field("kcal", "พลังงาน", "kcal")}
          {field("carbG", "คาร์บ", "ก.")}
        </div>
        <div className="flex gap-2">
          {field("sugarG", "น้ำตาล", "ก.")}
          {field("proteinG", "โปรตีน", "ก.")}
        </div>
      </div>

      {basis && (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[11px] leading-relaxed text-ink-600">
          {basis} · แตะที่ตัวเลขเพื่อแก้เองได้
        </p>
      )}
      {note && <p className="text-xs leading-relaxed text-ink-600">{note}</p>}
      {err && <p className="text-xs text-danger">{err}</p>}

      <button
        type="button"
        disabled={add.isPending || name.trim() === ""}
        onClick={() =>
          add.execute({
            // ไม่ส่งวันเมื่อเป็นวันนี้ ให้ฝั่งเซิร์ฟเวอร์คิดเองจากเวลาไทย —
            // นาฬิกาเครื่องผู้ใช้อาจตั้งไว้ผิดวัน หรือข้ามวันระหว่างกรอกอยู่
            eatenOn: isToday ? undefined : eatenOn,
            slot,
            name,
            portion: portion || null,
            source: fromAi ? "ai" : "user",
            kcal: toInt(nums.kcal),
            carbG: toInt(nums.carbG),
            sugarG: toInt(nums.sugarG),
            proteinG: toInt(nums.proteinG),
          })
        }
        className="flex h-11 items-center justify-center gap-2 rounded-md bg-brown-700 text-sm font-semibold text-white disabled:opacity-40"
      >
        <Plus size={17} strokeWidth={2} />
        บันทึกเมนู
      </button>
    </div>
  );
}
