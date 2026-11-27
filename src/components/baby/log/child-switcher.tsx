"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

/**
 * A2 — ลูกแฝด/หลายคน: แถบเลือกลูก แสดงการ์ดทีละคน
 *
 * จำคนที่เลือกไว้แค่ในหน้า ไม่เก็บลง URL — หน้าแรกไม่ควรมี query ค้าง
 */
export function ChildSwitcher({
  tabs,
  children,
}: {
  tabs: { id: string; name: string; status: string }[];
  children: React.ReactNode[];
}) {
  const [i, setI] = useState(0);
  return (
    <div className="flex flex-col gap-2">
      <div role="tablist" aria-label="เลือกลูก" className="flex gap-1 rounded-[10px] bg-cream-100 p-1">
        {tabs.map((t, idx) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={idx === i}
            onClick={() => setI(idx)}
            className={cn(
              "flex min-h-11 flex-1 flex-col items-start rounded-sm px-3 py-1.5 text-left",
              idx === i ? "bg-white shadow-[var(--shadow-card)]" : "text-ink-600",
            )}
          >
            <span className="text-sm font-medium text-ink-900">{t.name}</span>
            {t.status && <span className="text-[11px] text-ink-600">{t.status}</span>}
          </button>
        ))}
      </div>
      {children[i]}
    </div>
  );
}
