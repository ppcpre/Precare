"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { deleteFamily, leaveFamily } from "@/actions/family";

/** owner เท่านั้น — บังคับพิมพ์ชื่อครอบครัวยืนยัน กันกดพลาด */
export function DeleteFamily({ familyName }: { familyName: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const { execute, isPending, result } = useAction(deleteFamily, {
    onSuccess: () => router.push("/onboarding"),
  });

  if (!open) {
    return (
      <Button variant="ghost" className="text-danger hover:bg-cream-100" onClick={() => setOpen(true)}>
        <Trash2 size={18} strokeWidth={1.8} />
        ลบครอบครัวนี้
      </Button>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-md border border-danger bg-cream-100 p-4">
      <p className="text-sm leading-relaxed text-ink-900">
        การลบจะทำให้<strong>ข้อมูลสุขภาพ นัดหมาย และรูปทั้งหมดหายถาวร</strong> ย้อนกลับไม่ได้
        <br />
        พิมพ์ <strong>{familyName}</strong> เพื่อยืนยัน
      </p>
      <Field label="ชื่อครอบครัว" value={typed} onChange={(e) => setTyped(e.target.value)} />
      {result.serverError && <p className="text-xs text-danger">{result.serverError}</p>}
      <div className="flex gap-2">
        <Button variant="secondary" full onClick={() => setOpen(false)}>
          ยกเลิก
        </Button>
        <Button
          variant="danger"
          full
          loading={isPending}
          disabled={typed !== familyName}
          onClick={() => execute({ confirmName: typed })}
        >
          ลบถาวร
        </Button>
      </div>
    </div>
  );
}

/** editor / viewer — owner ออกเองไม่ได้ ต้องลบ family แทน */
export function LeaveFamily() {
  const router = useRouter();
  const { execute, isPending, result } = useAction(leaveFamily, {
    onSuccess: () => router.push("/onboarding"),
  });
  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="ghost"
        loading={isPending}
        onClick={() => {
          if (confirm("ออกจากครอบครัวนี้? คุณจะไม่เห็นข้อมูลของครอบครัวนี้อีก")) execute({});
        }}
      >
        <LogOut size={18} strokeWidth={1.8} />
        ออกจากครอบครัวนี้
      </Button>
      {result.serverError && <p className="text-center text-xs text-danger">{result.serverError}</p>}
    </div>
  );
}
