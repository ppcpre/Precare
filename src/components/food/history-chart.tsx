"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  bucketize,
  RANGES,
  RANGE_LABEL,
  type DailyTotal,
  type Metric,
  type Range,
} from "@/lib/food-history";
import { cn } from "@/lib/cn";

const CHOICES = [
  { key: "kcal", label: "พลังงาน", unit: "kcal", bar: "bg-peach-500" },
  { key: "carbG", label: "คาร์บ", unit: "ก.", bar: "bg-brown-300" },
  { key: "sugarG", label: "น้ำตาล", unit: "ก.", bar: "bg-danger" },
  { key: "proteinG", label: "โปรตีน", unit: "ก.", bar: "bg-sage-500" },
] as const satisfies readonly { key: Metric; label: string; unit: string; bar: string }[];

/**
 * กราฟแท่งย้อนหลัง — รายวัน / รายสัปดาห์ / รายเดือน
 *
 * ไม่ใช้ไลบรารีกราฟเลย: ข้อมูลคือตัวเลขไม่กี่สิบตัว แท่งคือ div ที่สูงเป็น %
 * การลากไลบรารีมาเพื่อสิ่งนี้แลกมาด้วย JS อีกเป็นร้อย KB ที่ผู้ใช้มือถือ
 * ต้องโหลดทุกครั้ง และ CPU ของ worker ที่มีให้แค่ 10ms ต่อ request
 *
 * ข้อมูลทั้งหมด (6 เดือน) ส่งมาครั้งเดียวแล้วจัดกลุ่มในเครื่อง การสลับมุมมอง
 * จึงไม่ต้องยิง request ใหม่ — ค่าที่ส่งมาเป็นผลรวมรายวันแล้ว ไม่ใช่ทุกแถว
 */
export function FoodHistoryChart({
  rows,
  today,
  userId,
  isMine,
}: {
  rows: DailyTotal[];
  today: string;
  userId: string;
  isMine: boolean;
}) {
  const [range, setRange] = useState<Range>("day");
  const [metric, setMetric] = useState<Metric>("kcal");

  const buckets = useMemo(() => bucketize(rows, range, today, metric), [rows, range, today, metric]);
  const m = CHOICES.find((x) => x.key === metric)!;

  const values = buckets.map((b) => b.value).filter((v): v is number => v != null);
  const max = Math.max(1, ...values);
  const logged = buckets.filter((b) => b.days > 0);
  const totalDays = logged.reduce((s, b) => s + b.days, 0);
  // ถ่วงด้วยจำนวนวันของแต่ละช่อง ไม่ใช่เฉลี่ยของเฉลี่ย ซึ่งให้น้ำหนักช่องที่มี
  // ข้อมูลวันเดียวเท่ากับช่องที่มีเจ็ดวัน
  const avg =
    totalDays === 0
      ? null
      : Math.round(logged.reduce((s, b) => s + (b.value ?? 0) * b.days, 0) / totalDays);

  const unitOf = (b: (typeof buckets)[number]) =>
    range === "day" ? "" : ` (เฉลี่ยจาก ${b.days} วัน)`;

  const dayHref = (key: string) => {
    const q = new URLSearchParams();
    if (key !== today) q.set("d", key);
    if (!isMine) q.set("u", userId);
    const s = q.toString();
    return s ? `/food?${s}` : "/food";
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="flex gap-1.5">
        {RANGES.map((r) => (
          <button
            key={r}
            type="button"
            aria-pressed={r === range}
            onClick={() => setRange(r)}
            className={cn(
              "h-11 flex-1 rounded-md text-[13px]",
              r === range
                ? "bg-brown-700 font-medium text-white"
                : "border border-cream-200 bg-white text-ink-600",
            )}
          >
            {RANGE_LABEL[r]}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CHOICES.map((x) => (
          <button
            key={x.key}
            type="button"
            aria-pressed={x.key === metric}
            onClick={() => setMetric(x.key)}
            className={cn(
              "min-h-11 rounded-full px-3 text-[13px]",
              x.key === metric
                ? "bg-cream-200 font-medium text-ink-900"
                : "border border-cream-200 bg-white text-ink-600",
            )}
          >
            {x.label}
          </button>
        ))}
      </div>

      {values.length === 0 ? (
        <p className="rounded-sm bg-cream-100 px-3 py-6 text-center text-[13px] text-ink-600">
          ยังไม่มีบันทึกในช่วงนี้
        </p>
      ) : (
        <>
          <p className="text-[11px] text-ink-600">
            เฉลี่ย <b className="text-ink-900">{avg?.toLocaleString("th-TH")}</b> {m.unit} ต่อวัน
            {" · "}บันทึกไว้ {totalDays} วัน
          </p>

          {/* แท่งสูงเป็น % ของค่าสูงสุดในช่วง — ไม่มีเป้าหมายให้เทียบ
              จึงเทียบกับตัวเองซึ่งเป็นสิ่งเดียวที่บอกแนวโน้มได้จริง */}
          <ul className="flex h-40 items-end gap-1" aria-label={`${m.label}${RANGE_LABEL[range]}`}>
            {buckets.map((b) => {
              const v = b.value;
              const bar =
                v == null ? (
                  <span className="h-1 w-full rounded-sm bg-cream-200" />
                ) : (
                  <span
                    className={cn("w-full rounded-sm", m.bar)}
                    style={{ height: `${Math.max(2, (v / max) * 100)}%` }}
                  />
                );
              const label =
                v == null
                  ? `${b.label}: ไม่มีบันทึก`
                  : `${b.label}: ${v.toLocaleString("th-TH")} ${m.unit}${unitOf(b)}`;

              return (
                <li key={b.key} className="flex h-full flex-1 flex-col justify-end">
                  {/**
                   * มุมมองรายวันแต่ละแท่งคือวันเดียว กดแล้วไปที่วันนั้นได้เลย
                   * — เห็นวันที่ดูเหมือนกินน้อยแล้วอยากไปเติมของที่ลืมจด
                   * มุมมองสัปดาห์/เดือนกดไม่ได้ เพราะหนึ่งแท่งคือหลายวัน
                   * ไม่รู้ว่าจะพาไปวันไหน
                   */}
                  {range === "day" ? (
                    <Link
                      href={dayHref(b.key)}
                      aria-label={`${label} · เปิดวันนี้เพื่อแก้`}
                      className="flex h-full flex-col justify-end"
                    >
                      {bar}
                    </Link>
                  ) : (
                    <span aria-label={label} className="flex h-full flex-col justify-end">
                      {bar}
                    </span>
                  )}
                </li>
              );
            })}
          </ul>
          <ul aria-hidden className="flex gap-1">
            {buckets.map((b, i) => (
              <li
                key={b.key}
                className="flex-1 overflow-hidden text-center text-[9px] leading-tight text-ink-400"
              >
                {/* รายวัน 14 ช่องใส่ป้ายทุกช่องจะทับกัน — เว้นช่องเป็นช่องเจาะ */}
                {range === "day" && i % 2 === 1 ? "" : b.label}
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
