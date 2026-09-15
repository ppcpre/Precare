"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Receipt, RotateCcw, ScanText, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { attachReceipt, rereadReceipt } from "@/actions/receipts";
import { saveCosts } from "@/actions/costs";
import { deletePhoto } from "@/actions/photos";
import { PHOTO_EDGE, resizeToWebp } from "@/lib/image";
import { formatBaht, parseBaht } from "@/lib/money";
import type { ReceiptRead } from "@/lib/receipt";
import type { ClaimStatus } from "@/db/schema";

type Item = { id: string; r2Key: string; receiptTotalSatang: number | null };

/**
 * ใบเสร็จและค่าใช้จ่ายของนัด
 *
 * กติกาเดียวที่ห้ามพลาด: **ยอดที่ AI อ่านได้ไม่เคยถูกบันทึกเอง**
 * มันเติมลงช่องให้ตรวจเท่านั้น ผู้ใช้ต้องกดบันทึกเอง — โมเดลอ่านผิดได้
 * และถ้ามีค่าใช้จ่ายที่ยืนยันไว้แล้ว ยอดใหม่จากใบเสร็จจะไม่ทับ แต่เสนอให้เลือกแทน
 */
export function AppointmentReceipts({
  appointmentId,
  items,
  costSatang,
  claimStatus,
  canWrite,
}: {
  appointmentId: string;
  items: Item[];
  costSatang: number | null;
  claimStatus: ClaimStatus;
  canWrite: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  const initialSuggestion = sumRead(items);
  const [amount, setAmount] = useState(
    costSatang != null
      ? formatBaht(costSatang)
      : initialSuggestion != null
        ? formatBaht(initialSuggestion)
        : "",
  );
  /** ค่าในช่องมาจากใบเสร็จ ยังไม่มีคนแก้ — ใช้ตัดสินว่าจะขึ้นป้าย "ตรวจก่อนบันทึก" */
  const [fromReceipt, setFromReceipt] = useState(costSatang == null && initialSuggestion != null);
  const [suggestion, setSuggestion] = useState<number | null>(initialSuggestion);
  const [notice, setNotice] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const attach = useAction(attachReceipt, {
    onSuccess: ({ data }) => data && onRead(data.read, data.suggestedSatang),
  });
  const reread = useAction(rereadReceipt, {
    onSuccess: ({ data }) => data && onRead(data.read, data.suggestedSatang),
  });
  const save = useAction(saveCosts, {
    onSuccess: () => {
      setFromReceipt(false);
      setNotice(null);
      router.refresh();
    },
  });
  const remove = useAction(deletePhoto, { onSuccess: () => router.refresh() });

  function onRead(read: ReceiptRead, suggested: number | null) {
    setSuggestion(suggested);
    if (read.status === "not_found") {
      setNotice("อ่านยอดรวมจากใบเสร็จนี้ไม่ออก — กรอกยอดเองได้เลย");
    } else if (read.status === "unavailable") {
      setNotice("ตอนนี้อ่านใบเสร็จอัตโนมัติไม่ได้ — กรอกยอดเองได้เลย หรือลองอ่านอีกครั้งภายหลัง");
    } else {
      setNotice(null);
      // เติมให้เฉพาะตอนช่องยังว่างหรือยังเป็นค่าที่มาจากใบเสร็จ
      // ถ้าผู้ใช้พิมพ์เองไว้แล้ว หรือมีค่าที่บันทึกไว้ ไม่ทับ — เสนอปุ่มให้เลือกแทน
      if (suggested != null && (amount.trim() === "" || fromReceipt)) {
        setAmount(formatBaht(suggested));
        setFromReceipt(true);
      }
    }
    router.refresh();
  }

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    // copy ออกมาก่อนล้าง input — FileList เป็น live object ตัวเดียวกับ input.files
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setNotice(null);
    setPreparing(true);
    try {
      // ย่อก่อนส่ง: รูปจากกล้องมือถือหลาย MB แต่ 1600px อ่านตัวเลขบนใบเสร็จได้ชัดพอ
      const blob = await resizeToWebp(file, PHOTO_EDGE);
      const fd = new FormData();
      fd.set("appointmentId", appointmentId);
      fd.set("file", new File([blob], "receipt.webp", { type: "image/webp" }));
      attach.execute(fd);
    } catch {
      setNotice("เปิดรูปนี้ไม่ได้ (รองรับ JPG, PNG, WebP)");
    } finally {
      setPreparing(false);
    }
  }

  const parsed = parseBaht(amount);
  const invalid = parsed === undefined;
  const dirty = parsed !== costSatang;
  const offerSuggestion =
    suggestion != null && !fromReceipt && parsed !== suggestion;
  const unread = items.filter((i) => i.receiptTotalSatang == null).length;
  const busy = preparing || attach.isPending;
  const serverError =
    attach.result.serverError ?? reread.result.serverError ?? save.result.serverError ?? remove.result.serverError;

  return (
    <section
      // เป้าของลิงก์ "ใบเสร็จ" บนการ์ดนัด — scroll-mt กันหัวข้อจมใต้แถบบนที่ติดขอบจอ
      id="receipts"
      className="flex scroll-mt-20 flex-col gap-3 rounded-md border border-cream-200 bg-white p-3.5 shadow-[var(--shadow-card)]"
    >
      <h2 className="flex items-center gap-1.5 text-sm font-medium text-ink-900">
        <Receipt size={17} strokeWidth={1.9} className="text-peach-700" />
        ใบเสร็จและค่าใช้จ่าย
      </h2>

      {items.length > 0 && (
        <ul className="flex flex-col gap-2">
          {items.map((it, i) => (
            <li key={it.id} className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element -- ไฟล์ส่วนตัวผ่าน /api/media ใช้ next/image ไม่ได้ */}
              <img
                src={`/api/media/${it.r2Key}`}
                alt={`ใบเสร็จใบที่ ${i + 1}`}
                className="size-12 shrink-0 rounded-[8px] border border-cream-200 object-cover"
              />
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm text-ink-900">ใบที่ {i + 1}</span>
                <span className="text-xs tabular-nums text-ink-400">
                  {it.receiptTotalSatang != null
                    ? `อ่านได้ ฿${formatBaht(it.receiptTotalSatang)}`
                    : "ยังอ่านยอดไม่ได้"}
                </span>
              </span>
              {canWrite && it.receiptTotalSatang == null && (
                <button
                  type="button"
                  aria-label={`อ่านใบที่ ${i + 1} อีกครั้ง`}
                  disabled={reread.isPending}
                  onClick={() => reread.execute({ id: it.id })}
                  className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
                >
                  <RotateCcw size={17} strokeWidth={1.9} />
                </button>
              )}
              {canWrite && (
                <button
                  type="button"
                  aria-label={`ลบใบเสร็จใบที่ ${i + 1}`}
                  disabled={remove.isPending}
                  onClick={() => {
                    if (confirm("ลบใบเสร็จนี้? ค่าใช้จ่ายที่บันทึกไว้จะไม่เปลี่ยนตาม")) {
                      remove.execute({ id: it.id });
                    }
                  }}
                  className="flex size-11 shrink-0 items-center justify-center rounded-sm text-ink-400 hover:bg-cream-100"
                >
                  <Trash2 size={17} strokeWidth={1.9} />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp"
            className="hidden"
            onChange={onPick}
            aria-label="เลือกรูปใบเสร็จ"
          />
          <Button variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
            <ScanText size={18} strokeWidth={1.9} />
            {busy ? "กำลังอ่านใบเสร็จ…" : "แนบใบเสร็จ"}
          </Button>
        </>
      )}

      {notice && (
        <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] leading-relaxed text-ink-600">{notice}</p>
      )}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="receipt-cost" className="text-sm text-ink-600">
          ค่าใช้จ่ายของนัดนี้
        </label>
        <div
          className="flex items-center gap-1.5 rounded-sm border bg-cream-50 px-3 has-[input:focus]:border-[1.5px] has-[input:focus]:border-brown-500"
          style={{ borderColor: invalid ? "var(--color-danger)" : undefined }}
        >
          <span className="text-sm text-ink-400">฿</span>
          <input
            id="receipt-cost"
            inputMode="decimal"
            disabled={!canWrite}
            aria-invalid={invalid}
            value={amount}
            placeholder="ยังไม่ระบุ"
            onChange={(e) => {
              setAmount(e.target.value);
              setFromReceipt(false);
            }}
            className="h-11 w-full min-w-0 bg-transparent text-right text-[15px] tabular-nums text-ink-900 placeholder:text-ink-400 focus:outline-none disabled:text-ink-600"
          />
        </div>

        {fromReceipt && !invalid && parsed != null && (
          <p className="text-xs leading-relaxed text-warning">
            ยอดนี้อ่านจากใบเสร็จอัตโนมัติ — ตรวจให้ตรงกับใบเสร็จก่อนบันทึก
          </p>
        )}
        {unread > 0 && suggestion != null && (
          <p className="text-xs leading-relaxed text-ink-400">
            มีใบเสร็จ {unread} ใบที่ยังอ่านยอดไม่ได้ และยังไม่ได้รวมอยู่ในยอดนี้
          </p>
        )}
        {offerSuggestion && canWrite && (
          <button
            type="button"
            onClick={() => {
              setAmount(formatBaht(suggestion));
              setFromReceipt(true);
            }}
            className="flex min-h-11 items-center self-start text-[13px] font-medium text-brown-700"
          >
            ใช้ยอดจากใบเสร็จ ฿{formatBaht(suggestion)}
          </button>
        )}
      </div>

      {serverError && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          {serverError}
        </p>
      )}

      {canWrite && (
        <Button
          loading={save.isPending}
          disabled={invalid || !dirty}
          onClick={() =>
            save.execute({
              rows: [{ id: appointmentId, costSatang: parsed as number | null, claimStatus }],
            })
          }
        >
          บันทึกค่าใช้จ่าย
        </Button>
      )}
    </section>
  );
}

function sumRead(items: Item[]) {
  const read = items.filter((i) => i.receiptTotalSatang != null);
  return read.length ? read.reduce((s, i) => s + (i.receiptTotalSatang ?? 0), 0) : null;
}
