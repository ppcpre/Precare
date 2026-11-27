"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { addChild, updateChild } from "@/actions/children";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { localToday } from "@/lib/local-time";

/**
 * ฟอร์มเพิ่ม/แก้ลูก
 *
 * วันเกิดแก้ได้ตลอด ไม่ล็อกหลังบันทึก — คนกรอกวันผิดกันจริง และการแก้ไม่มี
 * ผลข้างเคียงอะไรเลยเพราะช่องอายุของรูปคำนวณสดจากวันเกิดทุกครั้ง
 */
export function ChildForm({
  child,
  onDone,
}: {
  child?: { id: string; name: string; birthDate: string };
  onDone?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(child?.name ?? "");
  const [birth, setBirth] = useState(child?.birthDate ?? "");

  const add = useAction(addChild, {
    onSuccess: ({ data }) => {
      if (data?.id) router.push(`/baby/${data.id}`);
    },
  });
  const edit = useAction(updateChild, {
    onSuccess: () => {
      onDone?.();
      router.refresh();
    },
  });
  const run = child ? edit : add;
  const err = run.result?.serverError ?? run.result?.validationErrors?._errors?.[0];

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(e) => {
        e.preventDefault();
        if (child) edit.execute({ id: child.id, name, birthDate: birth });
        else add.execute({ name, birthDate: birth });
      }}
    >
      <Field
        label="ชื่อที่เรียก"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={40}
        placeholder="เช่น น้องมะลิ"
        required
      />
      <Field
        label="วันเกิด"
        type="date"
        value={birth}
        onChange={(e) => setBirth(e.target.value)}
        max={localToday()}
        hint="แก้ทีหลังได้ รูปจะขยับช่องตามให้เอง"
        required
      />
      {err && <p className="text-sm text-danger">{err}</p>}
      <Button type="submit" disabled={run.isPending || !name.trim() || !birth}>
        {run.isPending ? "กำลังบันทึก…" : child ? "บันทึกการแก้ไข" : "เพิ่มลูก"}
      </Button>
    </form>
  );
}
