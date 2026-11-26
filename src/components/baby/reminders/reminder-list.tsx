"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Clock, Moon } from "lucide-react";
import type { BabyLogKind } from "@/db/schema";
import { secondsBetween, spanLabel, type BabyLogView } from "@/lib/baby-log";
import {
  REMIND_TITLE,
  everyLabel,
  hasQuiet,
  reminderState,
  type ReminderState,
} from "@/lib/baby-reminder";
import type { BabyReminderView } from "@/lib/baby-queries";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { toggleBabyReminder } from "@/actions/baby-reminder";
import { Card } from "@/components/ui/card";
import { KindBadge } from "@/components/baby/log/kind-icon";

type Latest = Partial<Record<BabyLogKind, BabyLogView>>;

/** บรรทัด "อีก 35 นาที · 17:20" — คิดจากกติกาเดียวกับ cron */
export function nextLabel(state: ReminderState, nowIso: string | null): string {
  switch (state.status) {
    case "off":
      return "ปิดอยู่";
    case "no-log":
      return "เริ่มนับเมื่อบันทึกครั้งแรก";
    case "running":
      return "กำลังจับเวลาอยู่ · ยังไม่นับ";
    case "due": {
      if (!nowIso) return "";
      const hm = state.at.slice(11, 16);
      const day = state.at.slice(0, 10);
      const today = nowIso.slice(0, 10);
      const when = day === today ? hm : day > today ? `พรุ่งนี้ ${hm}` : `${hm} เมื่อวาน`;
      if (state.at <= nowIso) return `ถึงเวลาแล้ว · ${when}`;
      const left = `อีก ${spanLabel(secondsBetween(nowIso, state.at))} · ${when}`;
      // ไม่บอก เวลา 07:00 จะดูเหมือนคิดผิด ทั้งที่เลื่อนพ้นช่วงงดเตือนมา
      return state.shifted ? `${left} · หลังช่วงงดเตือน` : left;
    }
  }
}

export function ReminderList({
  childId,
  reminders,
  latest,
}: {
  childId: string;
  reminders: BabyReminderView[];
  latest: Latest;
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const toggle = useAction(toggleBabyReminder, { onSuccess: () => router.refresh() });

  return (
    <ul className="flex flex-col gap-3">
      {reminders.map((r) => {
        const state = reminderState(r.active, latest[r.kind], r);
        const title = REMIND_TITLE[r.kind];
        return (
          <li key={r.id}>
            <Card className="flex flex-col gap-2 p-3.5">
              <div className="flex items-start justify-between gap-3">
                <Link
                  href={`/baby/${childId}/reminders/${r.id}`}
                  className="flex min-w-0 flex-1 items-center gap-3"
                  aria-label={`แก้การแจ้งเตือน${title}`}
                >
                  <KindBadge kind={r.kind} size={40} />
                  <span className="flex min-w-0 flex-col">
                    <span className={cn("text-[15px] font-medium", r.active ? "text-ink-900" : "text-ink-400")}>
                      {title}
                    </span>
                    <span className={cn("text-[13px]", r.active ? "text-ink-900" : "text-ink-400")}>
                      {nextLabel(state, nowIso)}
                    </span>
                  </span>
                </Link>
                <button
                  type="button"
                  role="switch"
                  aria-checked={r.active}
                  aria-label={`เตือน${title}`}
                  disabled={toggle.isPending}
                  onClick={() => toggle.execute({ id: r.id, childId, active: !r.active })}
                  className="flex h-11 shrink-0 items-center"
                >
                  <span
                    className={cn(
                      "relative h-[26px] w-11 rounded-full transition-colors",
                      r.active ? "bg-brown-700" : "bg-cream-200",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-[3px] size-5 rounded-full bg-white transition-all",
                        r.active ? "right-[3px]" : "left-[3px]",
                      )}
                    />
                  </span>
                </button>
              </div>
              <div className="flex flex-wrap gap-x-3.5 gap-y-1 pl-[52px] text-xs text-ink-600">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} strokeWidth={1.9} className="text-ink-400" />
                  {everyLabel(r.everyMin)} หลังครั้งล่าสุด
                </span>
                <span className="flex items-center gap-1.5">
                  <Moon size={14} strokeWidth={1.9} className="text-ink-400" />
                  {hasQuiet(r) ? `งดเตือน ${r.quietFrom}–${r.quietTo}` : "เตือนตลอด"}
                </span>
              </div>
            </Card>
          </li>
        );
      })}
    </ul>
  );
}
