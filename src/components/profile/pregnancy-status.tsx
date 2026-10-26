"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { setPregnancyStatus } from "@/actions/pregnancy";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * สวิตช์ "คลอดแล้ว"
 *
 * ⚠️ ถ้อยคำทั้งหมดในไฟล์นี้เป็นกลางโดยตั้งใจ ไม่แสดงความยินดี ไม่พูดถึงลูก
 *    ไม่ถามเหตุผล การตั้งครรภ์ไม่ได้จบด้วยลูกเสมอไป และคนที่เพิ่งสูญเสีย
 *    ก็ต้องกดปุ่มนี้เหมือนกันเพื่อให้แอปหยุดนับอายุครรภ์
 *
 * มีขั้นยืนยันเพราะมันเปลี่ยนหน้าแรกของทุกคนในครอบครัวพร้อมกัน ไม่ใช่เพราะ
 * มันย้อนไม่ได้ — ย้อนได้ และปุ่มย้อนอยู่ที่เดียวกัน
 */
export function PregnancyStatusCard({ status }: { status: "pregnant" | "postpartum" }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const run = useAction(setPregnancyStatus, {
    onSuccess: () => {
      setConfirming(false);
      router.refresh();
    },
  });
  const err = run.result?.serverError;

  if (status === "postpartum") {
    return (
      <Card className="flex flex-col gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-medium text-ink-900">สถานะ: คลอดแล้ว</span>
          <span className="text-[13px] leading-relaxed text-ink-600">
            หยุดนับอายุครรภ์แล้ว บันทึกสุขภาพ รูป และนัดหมายทั้งหมดยังอยู่ครบ
          </span>
        </div>
        {err && <p className="text-sm text-danger">{err}</p>}
        <Button
          variant="secondary"
          disabled={run.isPending}
          onClick={() => run.execute({ status: "pregnant" })}
        >
          {run.isPending ? "กำลังบันทึก…" : "กดผิด — กลับไปเป็นกำลังตั้งครรภ์"}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex flex-col gap-0.5">
        <span className="font-medium text-ink-900">สถานะ: กำลังตั้งครรภ์</span>
        <span className="text-[13px] leading-relaxed text-ink-600">
          เมื่อตั้งครรภ์สิ้นสุดลง กดที่นี่เพื่อให้แอปหยุดนับอายุครรภ์
          การ์ดนับลูกดิ้นและจับเวลาการบีบตัวจะหายไปจากหน้าแรกของทุกคนในครอบครัว
        </span>
      </div>
      {err && <p className="text-sm text-danger">{err}</p>}
      {confirming ? (
        <div className="flex flex-col gap-2">
          <p className="rounded-sm bg-cream-100 px-3 py-2.5 text-[13px] leading-relaxed text-ink-600">
            ข้อมูลที่บันทึกไว้ไม่ถูกลบ และกดกลับได้ตลอด
          </p>
          <div className="flex gap-2">
            <Button
              className="flex-1"
              disabled={run.isPending}
              onClick={() => run.execute({ status: "postpartum" })}
            >
              {run.isPending ? "กำลังบันทึก…" : "ยืนยัน"}
            </Button>
            <Button
              variant="secondary"
              className="flex-1"
              disabled={run.isPending}
              onClick={() => setConfirming(false)}
            >
              ยกเลิก
            </Button>
          </div>
        </div>
      ) : (
        <Button variant="secondary" onClick={() => setConfirming(true)}>
          บันทึกว่าคลอดแล้ว
        </Button>
      )}
    </Card>
  );
}
