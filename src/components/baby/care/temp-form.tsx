"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { AlertTriangle, ChevronRight, Minus, Plus, X } from "lucide-react";
import { addChildTemp } from "@/actions/child-care";
import {
  TEMP_MAX_TENTHS,
  TEMP_MIN_TENTHS,
  TEMP_SITE_LABEL,
  TEMP_SYMPTOMS,
  tempLabel,
  type TempSite,
} from "@/lib/child-temp";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { Chip } from "@/components/ui/chip";
import { Segmented } from "@/components/ui/segmented";
import { TimeField, atFromTime } from "@/components/baby/log/time-field";

/**
 * D4 — บันทึกไข้
 *
 * ⚠️ ไม่มีเกณฑ์ตัวเลขว่า "มีไข้" — ลูกอายุต่ำกว่า 2 เดือนเห็นการ์ดที่ยกข้อความจาก
 *    หน้าอาการ (WHO IMNCI) มาคำต่อคำทุกครั้ง ไม่ว่าวัดได้เท่าไหร่ ส่วนเด็กโตกว่านั้นได้ลิงก์ไปหน้าอาการ
 */
export function TempForm({
  childId,
  childName,
  initialTenths,
  young,
  newbornNote,
  signsFor,
}: {
  childId: string;
  childName: string;
  initialTenths: number;
  /** อายุยังไม่ถึง 2 เดือน — คิดที่เซิร์ฟเวอร์จากวันเกิด */
  young: boolean;
  newbornNote: string;
  /** อาการที่เลือก → ข้อในหน้าอาการ (ส่งมาเป็นตาราง เพราะข้อมูลหน้าอาการอยู่ฝั่งเซิร์ฟเวอร์) */
  signsFor: { base: string[]; bySymptom: Record<string, string> };
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const [tenths, setTenths] = useState(initialTenths);
  const [site, setSite] = useState<TempSite>("armpit");
  const [symptoms, setSymptoms] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [time, setTime] = useState<string | null>(null);

  const save = useAction(addChildTemp, {
    onSuccess: () => {
      router.push(`/baby/${childId}/temp?saved=1`);
      router.refresh();
    },
  });

  const step = (d: number) => setTenths((v) => Math.min(TEMP_MAX_TENTHS, Math.max(TEMP_MIN_TENTHS, v + d)));
  const toggle = (s: string) => setSymptoms((arr) => (arr.includes(s) ? arr.filter((x) => x !== s) : [...arr, s]));
  const extra = symptoms.filter((s) => !(TEMP_SYMPTOMS as readonly string[]).includes(s));
  const signs = [
    ...signsFor.base,
    ...symptoms.map((s) => signsFor.bySymptom[s]).filter((x): x is string => !!x),
  ];

  const submit = () => {
    const at = time && nowIso ? atFromTime(time, nowIso) : localIso();
    save.execute({ childId, at, tempTenths: tenths, site, symptoms, note: null });
  };

  return (
    <div className="flex flex-col gap-4 pb-8">
      <header className="flex items-center justify-between">
        <Link
          href={`/baby/${childId}/log`}
          aria-label="ปิด"
          className="-ml-2 flex size-11 items-center justify-center rounded-full text-ink-600 hover:bg-cream-100"
        >
          <X size={22} />
        </Link>
        <h1 className="truncate text-lg font-semibold text-ink-900">บันทึกไข้ · {childName}</h1>
        <button
          type="button"
          onClick={submit}
          disabled={save.isPending}
          className="-mr-2 h-11 px-2 text-[15px] font-semibold text-brown-700 disabled:opacity-50"
        >
          บันทึก
        </button>
      </header>

      <div className="flex flex-col gap-1">
        <span className="text-sm text-ink-600">อุณหภูมิ</span>
        <div className="flex items-center justify-between gap-3 rounded-md border border-cream-200 bg-white p-2">
          <button
            type="button"
            aria-label="ลด 0.1 องศา"
            onClick={() => step(-1)}
            className="flex size-12 items-center justify-center rounded-full bg-cream-100 text-ink-900"
          >
            <Minus size={20} />
          </button>
          <output aria-live="polite" aria-label="อุณหภูมิ" className="text-[32px] font-semibold tabular-nums text-ink-900">
            {tempLabel(tenths)}
          </output>
          <button
            type="button"
            aria-label="เพิ่ม 0.1 องศา"
            onClick={() => step(1)}
            className="flex size-12 items-center justify-center rounded-full bg-cream-100 text-ink-900"
          >
            <Plus size={20} />
          </button>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-600">วัดที่</span>
        <Segmented
          label="วัดที่"
          value={site}
          onChange={setSite}
          options={(Object.keys(TEMP_SITE_LABEL) as TempSite[]).map((k) => ({ value: k, label: TEMP_SITE_LABEL[k] }))}
        />
      </div>

      <div className="flex flex-col gap-1.5">
        <span className="text-sm text-ink-600">อาการอื่น</span>
        <div className="flex flex-wrap gap-1.5">
          {[...TEMP_SYMPTOMS, ...extra].map((s) => (
            <Chip key={s} active={symptoms.includes(s)} onClick={() => toggle(s)}>
              {s}
            </Chip>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            const v = custom.trim();
            if (v && !symptoms.includes(v)) setSymptoms((arr) => [...arr, v]);
            setCustom("");
          }}
        >
          <input
            aria-label="พิมพ์อาการเอง"
            placeholder="+ พิมพ์เอง"
            value={custom}
            maxLength={40}
            onChange={(e) => setCustom(e.target.value)}
            className="h-11 min-w-0 flex-1 rounded-sm border border-cream-200 bg-cream-50 px-3 text-base text-ink-900 focus:border-[1.5px] focus:border-brown-500 focus:outline-none"
          />
          {custom.trim() && (
            <button type="submit" className="h-11 px-3 text-sm font-medium text-brown-700">
              เพิ่ม
            </button>
          )}
        </form>
      </div>

      {young && (
        <section
          aria-labelledby="young-title"
          className="flex flex-col gap-1.5 rounded-md border border-danger bg-cream-100 p-3.5"
        >
          <h2 id="young-title" className="flex items-center gap-2 text-[15px] font-semibold text-ink-900">
            <AlertTriangle size={18} strokeWidth={1.9} className="text-danger" />
            ลูกอายุต่ำกว่า 2 เดือน
          </h2>
          <p className="text-[13px] leading-relaxed text-ink-900">
            {signs.join(" · ")} อยู่ในรายการอาการที่ต้องพาไปโรงพยาบาล
          </p>
          <p className="text-[13px] leading-relaxed text-ink-600">วัยนี้{newbornNote}</p>
        </section>
      )}
      <Link
        href="/danger/child"
        className="flex min-h-11 items-center justify-center gap-0.5 text-sm font-medium text-brown-700"
      >
        ดูรายการอาการทั้งหมด
        <ChevronRight size={16} />
      </Link>

      {nowIso && <TimeField value={time} onChange={setTime} nowIso={nowIso} />}

      {(save.result.serverError || save.result.validationErrors) && (
        <p role="alert" className="text-[13px] text-danger">
          {save.result.serverError ?? "ข้อมูลไม่ถูกต้อง ลองตรวจอีกครั้ง"}
        </p>
      )}
    </div>
  );
}
