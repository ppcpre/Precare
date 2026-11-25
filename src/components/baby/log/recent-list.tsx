"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Trash2 } from "lucide-react";
import { deleteBabyLog } from "@/actions/baby-log";
import { KIND_LABEL, detailLabel, type BabyLogView } from "@/lib/baby-log";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { Card } from "@/components/ui/card";
import { KindBadge } from "./kind-icon";

/** รายการของวันนั้น ใหม่สุดก่อน · บอกทุกรายการว่าใครบันทึก */
export function RecentList({
  rows,
  meId,
  canWrite,
}: {
  rows: BabyLogView[];
  meId: string;
  canWrite: boolean;
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const del = useAction(deleteBabyLog, { onSuccess: () => router.refresh() });

  if (rows.length === 0) return null;

  return (
    <Card className="flex flex-col p-0">
      <h2 className="border-b border-cream-200 px-3.5 py-2.5 text-sm text-ink-600">รายการ</h2>
      <ul className="divide-y divide-cream-200">
        {rows.map((r) => {
          const who = r.createdBy === meId ? "คุณ" : (r.createdByName ?? "สมาชิก");
          const time =
            r.endedAt && r.endedAt !== r.startedAt
              ? `${r.startedAt.slice(11, 16)} – ${r.endedAt.slice(11, 16)}`
              : r.startedAt.slice(11, 16);
          const detail = nowIso ? detailLabel(r, nowIso) : "";
          return (
            <li key={r.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <KindBadge kind={r.kind} size={32} />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[15px] text-ink-900">
                  {KIND_LABEL[r.kind]}
                  {detail && ` · ${detail}`}
                </span>
                <span className="text-xs text-ink-600">
                  {time}
                  {r.endedAt === null && " · ยังไม่จบ"} · บันทึกโดย {who}
                </span>
              </span>
              {canWrite && r.endedAt !== null && (
                <button
                  type="button"
                  aria-label={`ลบ ${KIND_LABEL[r.kind]} ${time}`}
                  disabled={del.isPending}
                  onClick={() => {
                    if (confirm(`ลบ${KIND_LABEL[r.kind]} ${time}?`)) del.execute({ logId: r.id });
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-cream-100 hover:text-danger"
                >
                  <Trash2 size={17} strokeWidth={1.9} />
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </Card>
  );
}
