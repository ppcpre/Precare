import Link from "next/link";
import { Scale, Activity, AlertCircle, Pencil } from "lucide-react";
import { Card } from "@/components/ui/card";
import { MoodFace } from "@/components/mood";
import { dayMonth, isHighBp } from "@/lib/format";
import type { WeeklyLogView } from "@/types";

export function LogCard({
  log,
  recorderName,
  canEdit,
}: {
  log: WeeklyLogView;
  recorderName: string;
  canEdit: boolean;
}) {
  const high = isHighBp(log.bpSystolic, log.bpDiastolic);

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-xl font-semibold text-ink-900">สัปดาห์ที่ {log.week}</h3>
        <div className="flex items-center gap-2">
          {log.mood && <MoodFace mood={log.mood} size={26} className="text-ink-400" />}
          <span className="text-xs text-ink-400">{dayMonth(log.logDate)}</span>
          {/* viewer ไม่เห็นปุ่มแก้ไขเลย ไม่ใช่แค่ disabled */}
          {canEdit && (
            <Link
              href={`/health/${log.id}/edit`}
              aria-label={`แก้ไขบันทึกสัปดาห์ที่ ${log.week}`}
              className="flex size-8 items-center justify-center rounded-sm text-ink-400 hover:bg-cream-100 hover:text-ink-600"
            >
              <Pencil size={16} strokeWidth={1.8} />
            </Link>
          )}
        </div>
      </div>

      {(log.weight != null || log.bpSystolic != null) && (
        <>
          <span className="h-px bg-cream-200" />
          <div className="flex items-center justify-between gap-4">
            {log.weight != null && (
              <span className="flex items-center gap-2">
                <Scale size={18} strokeWidth={1.8} className="text-ink-400" />
                <span className="font-medium text-ink-900">{log.weight} กก.</span>
              </span>
            )}
            {log.bpSystolic != null && log.bpDiastolic != null && (
              <span className="flex items-center gap-2">
                <Activity
                  size={18}
                  strokeWidth={1.8}
                  className={high ? "text-danger" : "text-ink-400"}
                />
                <span className={high ? "font-medium text-danger" : "font-medium text-ink-900"}>
                  {log.bpSystolic}/{log.bpDiastolic}
                </span>
                {/* ค่าผิดปกติเน้นเฉพาะตัวเลข ไม่ทำแถบแดงทั้งการ์ด */}
                {high && <AlertCircle size={15} strokeWidth={1.9} className="text-danger" />}
              </span>
            )}
          </div>
        </>
      )}

      {log.symptoms.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {log.symptoms.map((s) => (
            <span
              key={s}
              className="rounded-full bg-brown-100 px-3 py-1 text-xs text-brown-900"
            >
              {s}
            </span>
          ))}
        </div>
      )}

      {log.note && <p className="text-sm leading-relaxed text-ink-600">{log.note}</p>}

      <span className="text-right text-xs text-ink-400">บันทึกโดย {recorderName}</span>
    </Card>
  );
}
