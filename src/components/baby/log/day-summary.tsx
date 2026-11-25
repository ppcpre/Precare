import type { BabyLogKind } from "@/db/schema";
import {
  KIND_LABEL,
  MILK_LABEL,
  spanLabel,
  type DaySummary as Summary,
} from "@/lib/baby-log";
import { Card } from "@/components/ui/card";
import { KindBadge } from "./kind-icon";

/**
 * สรุปของวัน — จำนวนครั้ง + รายละเอียดที่พยาบาลถามบ่อย
 *
 * ⚠️ ไม่มีคำว่า "น้อยไป" "ปกติ" หรือสีเตือน เกณฑ์พวกนั้นรอแพทย์ตรวจถ้อยคำ
 */
export function DaySummaryCard({ s, title = "สรุปวันนี้" }: { s: Summary; title?: string }) {
  const rows: { kind: BabyLogKind; count: number; main: string; sub?: string }[] = [
    {
      kind: "breast",
      count: s.breast.count,
      main: spanLabel(s.breast.left + s.breast.right),
      sub: `ซ้าย ${spanLabel(s.breast.left)} · ขวา ${spanLabel(s.breast.right)}`,
    },
    {
      kind: "bottle",
      count: s.bottle.count,
      main: `${s.bottle.ml} มล.`,
      sub: s.bottle.milks.map((m) => MILK_LABEL[m]).join(" · ") || undefined,
    },
    {
      kind: "diaper",
      count: s.diaper.count,
      main: `ฉี่ ${s.diaper.wet} · อึ ${s.diaper.dirty}`,
      sub: "ผืนที่มีทั้งสองอย่างนับทั้งคู่",
    },
    {
      kind: "sleep",
      count: s.sleep.count,
      main: spanLabel(s.sleep.sec),
      sub: s.sleep.running ? "รวมรอบที่กำลังนอนอยู่" : undefined,
    },
    {
      kind: "pump",
      count: s.pump.count,
      main: `${s.pump.ml} มล.`,
      sub: `ซ้าย ${s.pump.left} · ขวา ${s.pump.right}`,
    },
    { kind: "bath", count: s.bath.count, main: KIND_LABEL.bath },
  ];
  // นอนที่เริ่มเมื่อวานแล้วตื่นวันนี้ นับครั้งเป็นของเมื่อวาน แต่เวลายังต้องขึ้น
  const shown = rows.filter((r) => r.count > 0 || (r.kind === "sleep" && s.sleep.sec > 0));

  return (
    <Card className="flex flex-col p-0">
      <h2 className="border-b border-cream-200 px-3.5 py-2.5 text-sm text-ink-600">{title}</h2>
      {shown.length === 0 ? (
        <p className="px-3.5 py-4 text-[13px] text-ink-600">ยังไม่มีบันทึก</p>
      ) : (
        <ul className="divide-y divide-cream-200">
          {shown.map((r) => (
            <li key={r.kind} className="flex items-center gap-3 px-3.5 py-2.5">
              <KindBadge kind={r.kind} size={32} />
              <span className="w-6 text-lg font-semibold tabular-nums text-ink-900" aria-label={`${r.count} ครั้ง`}>
                {r.count}
              </span>
              <span className="flex min-w-0 flex-col">
                <span className="text-[15px] text-ink-900">{r.main}</span>
                {r.sub && <span className="text-xs text-ink-600">{r.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

/** บรรทัดเดียวใต้ปุ่มกดด่วนบนหน้าแรก */
export function summaryLine(s: Summary): string {
  const parts = [`กิน ${s.breast.count + s.bottle.count}`, `ผ้าอ้อม ${s.diaper.count}`];
  if (s.sleep.sec) parts.push(`นอน ${spanLabel(s.sleep.sec)}`);
  return parts.join(" · ");
}
