import type { StripLane, StripMark } from "@/lib/baby-log";
import { cn } from "@/lib/cn";
import { KIND_TONE } from "./kind-icon";

const LANES: { id: StripLane; label: string }[] = [
  { id: "feed", label: "กิน" },
  { id: "diaper", label: "ผ้าอ้อม" },
  { id: "sleep", label: "นอน" },
];
const pct = (min: number) => `${(min / 1440) * 100}%`;

/**
 * แถบ 24 ชั่วโมง แยก 3 เลน กิน / ผ้าอ้อม / นอน
 *
 * แยกเลนเพราะแอปตัวอย่างวางไอคอนทุกอย่างบนแถวเดียว ช่วงที่กินถี่ไอคอนซ้อนกันจนอ่านไม่ออก
 * ช่วงกลางคืน (ก่อน 6 โมง หลัง 1 ทุ่ม) แรเงาไว้ให้เห็นว่าคืนนี้ตื่นกี่รอบ
 */
export function DayStrip({ marks, nowMin }: { marks: StripMark[]; nowMin: number | null }) {
  return (
    <figure className="flex flex-col gap-1.5">
      <div className="relative h-4 text-[10px] text-ink-400" aria-hidden>
        {[3, 6, 9, 12, 15, 18, 21].map((h) => (
          <span key={h} className="absolute -translate-x-1/2 tabular-nums" style={{ left: pct(h * 60) }}>
            {h}
          </span>
        ))}
      </div>
      <div
        className="relative overflow-hidden rounded-sm border border-cream-200 bg-white"
        role="img"
        aria-label={`วันนี้มีบันทึก ${marks.length} รายการ`}
      >
        <span className="absolute inset-y-0 left-0 bg-cream-100" style={{ width: pct(360) }} />
        <span className="absolute inset-y-0 right-0 bg-cream-100" style={{ width: pct(300) }} />
        {[3, 6, 9, 12, 15, 18, 21].map((h) => (
          <span
            key={h}
            className="absolute inset-y-0 w-px bg-cream-200"
            style={{ left: pct(h * 60) }}
          />
        ))}
        {LANES.map((lane) => (
          <div key={lane.id} className="relative h-6">
            {marks
              .filter((m) => m.lane === lane.id)
              .map((m) => (
                <Mark key={m.id} m={m} />
              ))}
          </div>
        ))}
        {nowMin != null && (
          <span
            aria-hidden
            className="absolute inset-y-0 w-0.5 bg-brown-700"
            style={{ left: pct(nowMin) }}
          />
        )}
      </div>
      <figcaption className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-600">
        <Legend cls={cn(KIND_TONE.breast.bar, "h-2.5 w-1.5 rounded-[2px]")} label="เต้า" />
        <Legend cls={cn(KIND_TONE.bottle.bar, "size-2.5 rounded-[2px]")} label="ขวด" />
        <Legend cls={cn(KIND_TONE.pump.bar, "size-2.5 rounded-[2px]")} label="ปั๊ม" />
        <Legend cls="size-2.5 rounded-full border-[1.5px] border-sage-700 bg-white" label="ฉี่" />
        <Legend cls="size-2.5 rounded-full bg-sage-700" label="อึ" />
        <Legend cls="h-2.5 w-4 rounded-[3px] border border-plum-700 bg-plum-100" label="นอน" />
      </figcaption>
    </figure>
  );
}

function Mark({ m }: { m: StripMark }) {
  const left = pct(m.from);
  if (m.lane === "sleep") {
    return (
      <span
        className={cn(
          "absolute top-1 h-4 rounded-[3px] border border-plum-700 bg-plum-100",
          m.running && "border-dashed",
        )}
        style={{ left, width: `max(4px, ${pct(m.to - m.from)})` }}
      />
    );
  }
  if (m.lane === "diaper") {
    const ring = "size-2.5 rounded-full border-[1.5px] border-sage-700 bg-white";
    const fill = "size-2.5 rounded-full bg-sage-700";
    return (
      <span className="absolute top-1.5 flex -translate-x-1/2 gap-px" style={{ left }}>
        {m.diaper !== "dirty" && <span className={ring} />}
        {m.diaper !== "wet" && <span className={fill} />}
      </span>
    );
  }
  // กิน: เต้าเป็นแท่งยาวตามเวลา ขวด/ปั๊มเป็นจุด
  const tone = KIND_TONE[m.kind].bar;
  if (m.kind === "breast") {
    return (
      <span
        className={cn("absolute top-1.5 h-3 rounded-[2px]", tone)}
        style={{ left, width: `max(4px, ${pct(m.to - m.from)})` }}
      />
    );
  }
  return <span className={cn("absolute top-1.5 size-3 -translate-x-1/2 rounded-[2px]", tone)} style={{ left }} />;
}

function Legend({ cls, label }: { cls: string; label: string }) {
  return (
    <span className="flex items-center gap-1">
      <span aria-hidden className={cls} />
      {label}
    </span>
  );
}
