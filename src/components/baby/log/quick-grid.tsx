"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Bell, Minus, Plus } from "lucide-react";
import type { BabyLogKind } from "@/db/schema";
import { addBabyLog, deleteBabyLog } from "@/actions/baby-log";
import {
  DIAPER_LABEL,
  KIND_LABEL,
  KIND_ORDER,
  MILK_LABEL,
  SIDE_LABEL,
  breastTotals,
  clockSec,
  nextSide,
  secondsBetween,
  sinceAnchor,
  spanLabel,
  type BabyLogView,
  type DiaperKind,
  type MilkKind,
} from "@/lib/baby-log";
import { localIso } from "@/lib/kicks";
import { useNow } from "@/lib/use-now";
import { cn } from "@/lib/cn";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Sheet } from "@/components/ui/sheet";
import { KIND_TONE, KindBadge, KindIcon } from "./kind-icon";
import { TimeField, atFromTime } from "./time-field";

type Latest = Partial<Record<BabyLogKind, BabyLogView>>;

const RUNNING_LABEL: Partial<Record<BabyLogKind, string>> = {
  breast: "กำลังให้นม",
  sleep: "กำลังนอน",
};

/**
 * ปุ่มกดด่วน 6 อย่าง + บอกว่าผ่านไปนานแค่ไหนแล้วตั้งแต่ครั้งล่าสุด
 *
 * viewer เห็นเป็นการ์ดสถานะ ไม่ใช่ปุ่ม — หลักเดิมของแอปคือซ่อน ไม่ใช่ disabled
 * ของที่จับเวลา (เต้า นอน) เปิดเต็มจอ · ของที่จบในแตะเดียว (ขวด ผ้าอ้อม อาบน้ำ) ทำในนี้เลย
 */
export function QuickGrid({
  childId,
  latest,
  canWrite,
  reminded = [],
}: {
  childId: string;
  latest: Latest;
  canWrite: boolean;
  /** ประเภทที่ "ฉัน" ตั้งเตือนไว้และเปิดอยู่ — ขึ้นกระดิ่งเล็กที่มุมปุ่ม */
  reminded?: BabyLogKind[];
}) {
  const router = useRouter();
  const now = useNow();
  const nowIso = now ? localIso(new Date(now)) : null;
  const [sheet, setSheet] = useState<"bottle" | "diaper" | null>(null);
  const [toast, setToast] = useState<{ id: string; text: string } | null>(null);

  const add = useAction(addBabyLog, {
    onSuccess: ({ data, input }) => {
      if (!data) return;
      const at = input.at.slice(11, 16);
      const what =
        input.kind === "diaper"
          ? `ผ้าอ้อม · ${DIAPER_LABEL[input.diaper]}`
          : input.kind === "bottle"
            ? `ขวดนม ${input.ml} มล.`
            : KIND_LABEL[input.kind];
      setToast({ id: data.id, text: `บันทึกแล้ว · ${what} ${at}` });
      router.refresh();
    },
  });
  const undo = useAction(deleteBabyLog, {
    onSuccess: () => {
      setToast(null);
      router.refresh();
    },
  });
  const close = useCallback(() => setSheet(null), []);

  const lastBottle = latest.bottle;

  return (
    <>
      <div className="grid grid-cols-3 gap-2">
        {KIND_ORDER.map((k) => (
          <Tile
            key={k}
            kind={k}
            row={latest[k]}
            nowIso={nowIso}
            hint={k === "breast" ? nextSide(latest.breast) : null}
            canWrite={canWrite}
            reminded={reminded.includes(k)}
            href={
              k === "breast" || k === "sleep"
                ? `/baby/${childId}/log/${k}`
                : k === "pump"
                  ? `/baby/pump?child=${childId}`
                  : null
            }
            onTap={
              k === "bottle" || k === "diaper"
                ? () => setSheet(k)
                : k === "bath"
                  ? () => add.execute({ kind: "bath", childId, at: localIso() })
                  : undefined
            }
          />
        ))}
      </div>

      {add.result.serverError && (
        <p role="alert" className="text-[13px] text-danger">
          {add.result.serverError}
        </p>
      )}

      {sheet === "bottle" && nowIso && (
        <BottleSheet
          nowIso={nowIso}
          initialMl={lastBottle?.ml ?? 90}
          initialMilk={lastBottle?.milk ?? "breast"}
          pending={add.isPending}
          onClose={close}
          onSave={(v) => {
            add.execute({ kind: "bottle", childId, ...v });
            close();
          }}
        />
      )}
      {sheet === "diaper" && nowIso && (
        <DiaperSheet
          nowIso={nowIso}
          onClose={close}
          onPick={(diaper, at) => {
            add.execute({ kind: "diaper", childId, diaper, at });
            close();
          }}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-[calc(4.5rem+var(--safe-b))] z-40 mx-auto flex max-w-md items-center justify-between gap-3 rounded-md bg-ink-900 px-4 py-3 text-sm text-white shadow-[var(--shadow-modal)] md:bottom-6"
        >
          <span>{toast.text}</span>
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => undo.execute({ logId: toast.id })}
              disabled={undo.isPending}
              className="h-9 rounded-sm px-2 font-medium text-peach-300"
            >
              เลิกทำ
            </button>
            <button
              type="button"
              aria-label="ปิด"
              onClick={() => setToast(null)}
              className="h-9 px-1 text-cream-300"
            >
              ✕
            </button>
          </span>
        </div>
      )}
    </>
  );
}

function Tile({
  kind,
  row,
  nowIso,
  hint,
  canWrite,
  reminded,
  href,
  onTap,
}: {
  reminded: boolean;
  kind: BabyLogKind;
  row: BabyLogView | undefined;
  nowIso: string | null;
  hint: "left" | "right" | null;
  canWrite: boolean;
  href: string | null;
  onTap?: () => void;
}) {
  const running = row != null && row.endedAt === null;
  const tone = KIND_TONE[kind];

  let main = "ยังไม่มี";
  if (row && nowIso) {
    if (running) {
      const sec =
        kind === "breast"
          ? (() => {
              const t = breastTotals(row, nowIso);
              return t.left + t.right;
            })()
          : secondsBetween(row.startedAt, nowIso);
      main = clockSec(sec);
    } else {
      main = spanLabel(secondsBetween(sinceAnchor(row), nowIso));
    }
  } else if (row) {
    main = "—";
  }

  const body = (
    <>
      {reminded && (
        <Bell
          aria-label="ตั้งเตือนไว้"
          size={13}
          strokeWidth={2}
          className={cn("absolute top-2 right-2", running ? "text-white" : "text-ink-400")}
        />
      )}
      {running ? (
        <span className={cn("flex size-10 items-center justify-center rounded-full bg-white/20 text-white")}>
          <KindIcon kind={kind} size={20} />
        </span>
      ) : (
        <KindBadge kind={kind} />
      )}
      <span className={cn("text-[15px] font-medium", running ? "text-white" : "text-ink-900")}>
        {running ? RUNNING_LABEL[kind] : KIND_LABEL[kind]}
      </span>
      <span
        className={cn(
          "text-[13px] tabular-nums",
          running ? "font-semibold text-white" : "text-ink-600",
        )}
      >
        {main}
      </span>
      {!running && hint && (
        <span className="text-[11px] text-ink-400">ต่อไป: {SIDE_LABEL[hint]}</span>
      )}
    </>
  );

  const cls = cn(
    "relative flex min-h-[7.5rem] flex-col items-center justify-center gap-1 rounded-md border p-2 text-center",
    running ? cn(tone.solid, "border-transparent") : "border-cream-200 bg-white",
  );

  if (!canWrite) return <div className={cls}>{body}</div>;
  if (href)
    return (
      <Link href={href} className={cn(cls, "active:scale-[0.98]")}>
        {body}
      </Link>
    );
  return (
    <button type="button" onClick={onTap} className={cn(cls, "active:scale-[0.98]")}>
      {body}
    </button>
  );
}

const PRESETS = [60, 90, 120, 150];

function BottleSheet({
  nowIso,
  initialMl,
  initialMilk,
  pending,
  onClose,
  onSave,
}: {
  nowIso: string;
  initialMl: number;
  initialMilk: MilkKind;
  pending: boolean;
  onClose: () => void;
  onSave: (v: { ml: number; milk: MilkKind; at: string }) => void;
}) {
  const [ml, setMl] = useState(initialMl);
  const [milk, setMilk] = useState<MilkKind>(initialMilk);
  const [time, setTime] = useState<string | null>(null);

  return (
    <Sheet title="ขวดนม" onClose={onClose}>
      <Segmented
        label="ชนิดนม"
        value={milk}
        onChange={setMilk}
        options={(Object.keys(MILK_LABEL) as MilkKind[]).map((v) => ({ value: v, label: MILK_LABEL[v] }))}
      />
      <div className="flex items-center justify-between">
        <StepButton label="ลด 10 มล." onClick={() => setMl((v) => Math.max(10, v - 10))}>
          <Minus size={20} />
        </StepButton>
        <span className="text-4xl font-semibold tabular-nums text-ink-900">
          {ml} <span className="text-base font-normal text-ink-600">มล.</span>
        </span>
        <StepButton label="เพิ่ม 10 มล." onClick={() => setMl((v) => Math.min(500, v + 10))}>
          <Plus size={20} />
        </StepButton>
      </div>
      <div className="flex justify-center gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMl(p)}
            className={cn(
              "h-11 min-w-14 rounded-full px-3 text-sm tabular-nums",
              p === ml ? "bg-brown-100 font-medium text-brown-900" : "bg-cream-100 text-ink-600",
            )}
          >
            {p}
          </button>
        ))}
      </div>
      <p className="text-center text-xs text-ink-400">ตั้งต้นจากปริมาณครั้งก่อนของลูกคนนี้</p>
      <TimeField value={time} onChange={setTime} nowIso={nowIso} />
      <Button
        full
        loading={pending}
        onClick={() =>
          onSave({ ml, milk, at: time ? atFromTime(time, localIso()) : localIso() })
        }
      >
        บันทึก
      </Button>
    </Sheet>
  );
}

function DiaperSheet({
  nowIso,
  onClose,
  onPick,
}: {
  nowIso: string;
  onClose: () => void;
  onPick: (d: DiaperKind, at: string) => void;
}) {
  const [time, setTime] = useState<string | null>(null);
  const opts: { v: DiaperKind; sub: string }[] = [
    { v: "wet", sub: "เปียก" },
    { v: "dirty", sub: "มีอุจจาระ" },
    { v: "both", sub: "มีทั้งสอง" },
  ];
  return (
    <Sheet title="ผ้าอ้อม" onClose={onClose}>
      <p className="-mt-2 text-[13px] text-ink-600">แตะครั้งเดียวบันทึกเลย ไม่ต้องกดยืนยัน</p>
      <div className="grid grid-cols-3 gap-2">
        {opts.map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => onPick(o.v, time ? atFromTime(time, localIso()) : localIso())}
            className="flex min-h-24 flex-col items-center justify-center gap-1 rounded-md border border-sage-100 bg-sage-100/60 active:scale-[0.98]"
          >
            <DiaperDots kind={o.v} />
            <span className="text-[15px] font-medium text-ink-900">{DIAPER_LABEL[o.v]}</span>
            <span className="text-[11px] text-ink-600">{o.sub}</span>
          </button>
        ))}
      </div>
      <TimeField value={time} onChange={setTime} nowIso={nowIso} />
    </Sheet>
  );
}

export function DiaperDots({ kind }: { kind: DiaperKind }) {
  const ring = <span className="size-3 rounded-full border-[1.5px] border-sage-700 bg-white" />;
  const fill = <span className="size-3 rounded-full bg-sage-700" />;
  return (
    <span aria-hidden className="flex gap-1">
      {kind === "wet" ? ring : kind === "dirty" ? fill : (
        <>
          {ring}
          {fill}
        </>
      )}
    </span>
  );
}

function StepButton({
  label,
  onClick,
  children,
}: {
  label: string;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="flex size-12 items-center justify-center rounded-full border border-cream-300 text-ink-900 active:bg-cream-100"
    >
      {children}
    </button>
  );
}
