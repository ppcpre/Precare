"use client";

import { isHighBp } from "@/lib/format";

/** ความดันโลหิต 2 ช่องคู่ — เตือน inline ถ้าเกินเกณฑ์ แต่ไม่บล็อกการบันทึก */
export function BpInput({
  systolic,
  diastolic,
  onChange,
}: {
  systolic: string;
  diastolic: string;
  onChange: (sys: string, dia: string) => void;
}) {
  const s = systolic ? Number(systolic) : null;
  const d = diastolic ? Number(diastolic) : null;
  const high = isHighBp(s, d);

  const box =
    "h-11 w-full rounded-sm border border-cream-200 bg-cream-50 text-center text-base " +
    "text-ink-900 focus:border-[1.5px] focus:border-brown-500 focus:outline-none";

  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm text-ink-600">ความดันโลหิต</span>
      <div className="flex items-center gap-2.5">
        <input
          className={box}
          inputMode="numeric"
          placeholder="120"
          aria-label="ความดันตัวบน"
          value={systolic}
          onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 3), diastolic)}
        />
        <span aria-hidden className="text-xl text-ink-400">
          /
        </span>
        <input
          className={box}
          inputMode="numeric"
          placeholder="80"
          aria-label="ความดันตัวล่าง"
          value={diastolic}
          onChange={(e) => onChange(systolic, e.target.value.replace(/\D/g, "").slice(0, 3))}
        />
        <span className="w-12 shrink-0 text-sm text-ink-600">mmHg</span>
      </div>
      <div className="flex gap-2.5 text-xs text-ink-400">
        <span className="flex-1 text-center">ตัวบน</span>
        <span className="w-3" />
        <span className="flex-1 text-center">ตัวล่าง</span>
        <span className="w-12 shrink-0" />
      </div>
      {high && (
        /* เตือนแต่ไม่ห้ามบันทึก — ค่าจริงอาจสูงได้ หน้าที่วินิจฉัยเป็นของแพทย์ */
        <p className="text-xs text-danger">
          ค่าสูงกว่าเกณฑ์ปกติ (140/90) บันทึกได้ตามปกติ แนะนำให้แจ้งคุณหมอ
        </p>
      )}
    </div>
  );
}
