"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { MoreVertical, UserMinus, ShieldCheck, Eye } from "lucide-react";
import { changeMemberRole, removeMember } from "@/actions/family";
import type { Role } from "@/types";

/**
 * เมนู ⋮ ของสมาชิก — owner เท่านั้นที่เห็น และไม่แสดงบนแถวตัวเอง
 * ใช้ <details> เพราะได้ keyboard + screen reader มาฟรีโดยไม่ต้องพึ่ง library
 * (ประหยัด bundle เทียบกับดึง Radix มาเพื่อเมนู 2 รายการ)
 */
export function MemberActions({
  userId,
  name,
  role,
}: {
  userId: string;
  name: string;
  role: Role;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const refresh = () => {
    setOpen(false);
    router.refresh();
  };

  const change = useAction(changeMemberRole, { onSuccess: refresh });
  const remove = useAction(removeMember, { onSuccess: refresh });
  const err = change.result.serverError ?? remove.result.serverError;

  const nextRole: Role = role === "editor" ? "viewer" : "editor";

  return (
    <details
      open={open}
      onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)}
      className="relative shrink-0"
    >
      <summary
        aria-label={`ตัวเลือกสำหรับ ${name}`}
        className="flex size-8 cursor-pointer list-none items-center justify-center rounded-sm text-ink-400 hover:bg-cream-100 hover:text-ink-600"
      >
        <MoreVertical size={20} strokeWidth={1.9} />
      </summary>

      <div className="absolute right-0 z-20 mt-1 flex w-60 flex-col overflow-hidden rounded-md border border-cream-200 bg-white shadow-[var(--shadow-modal)]">
        <button
          type="button"
          disabled={change.isPending}
          onClick={() => change.execute({ userId, role: nextRole })}
          className="flex h-auto min-h-0 items-start gap-2.5 px-3.5 py-3 text-left hover:bg-cream-50"
        >
          {nextRole === "editor" ? (
            <ShieldCheck size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-brown-700" />
          ) : (
            <Eye size={18} strokeWidth={1.8} className="mt-0.5 shrink-0 text-ink-600" />
          )}
          <span className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-ink-900">
              เปลี่ยนเป็น {nextRole === "editor" ? "แก้ไขได้" : "ดูอย่างเดียว"}
            </span>
            <span className="text-xs leading-relaxed text-ink-600">
              {nextRole === "editor"
                ? "เพิ่มและแก้ไขบันทึกสุขภาพ นัดหมายได้"
                : "ดูข้อมูลได้ แต่แก้ไขอะไรไม่ได้"}
            </span>
          </span>
        </button>

        <span className="h-px bg-cream-200" />

        <button
          type="button"
          disabled={remove.isPending}
          onClick={() => {
            if (confirm(`นำ ${name} ออกจากครอบครัว?`)) remove.execute({ userId });
          }}
          className="flex h-auto min-h-0 items-center gap-2.5 px-3.5 py-3 text-left text-sm font-medium text-danger hover:bg-cream-50"
        >
          <UserMinus size={18} strokeWidth={1.8} className="shrink-0" />
          นำออกจากครอบครัว
        </button>

        {err && <p className="px-3.5 py-2 text-xs text-danger">{err}</p>}
      </div>
    </details>
  );
}
