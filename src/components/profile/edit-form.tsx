"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { ChevronLeft, Camera, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Avatar } from "@/components/app-topbar";
import { updateProfile } from "@/actions/profile";

export function ProfileEditForm({
  name: initialName,
  email,
  image,
}: {
  name: string;
  email: string;
  image: string | null;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);

  const { execute, isPending, result } = useAction(updateProfile, {
    onSuccess: () => {
      router.push("/profile");
      router.refresh();
    },
  });

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="flex h-14 items-center gap-1 border-b border-cream-200 bg-white px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="ย้อนกลับ"
          className="flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <ChevronLeft size={22} strokeWidth={1.8} />
        </button>
        <h1 className="font-semibold text-ink-900">แก้ไขโปรไฟล์</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[480px] flex-1 flex-col gap-6 p-4">
        <div className="flex flex-col items-center gap-3 pt-2">
          <div className="relative">
            <Avatar name={initialName} image={image} size={104} />
            {/* T5.12 จะทำให้กดแล้วอัปโหลดจริง ตอนนี้ปุ่มยังไม่ทำงาน จึงบอกให้ชัด */}
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white bg-cream-200"
            >
              <Camera size={15} strokeWidth={1.9} className="text-ink-400" />
            </span>
          </div>
          <p className="text-xs text-ink-400">อัปโหลดรูปโปรไฟล์ได้เร็วๆ นี้</p>
        </div>

        <Field
          label="ชื่อ-นามสกุล"
          value={name}
          onChange={(e) => setName(e.target.value)}
          maxLength={80}
          autoFocus
        />

        <div className="flex flex-col gap-1.5">
          <Field label="อีเมล" value={email} readOnly disabled />
          <p className="flex items-center gap-1.5 text-xs text-ink-400">
            <Lock size={13} strokeWidth={1.9} />
            อีเมลคือชื่อผู้ใช้ เปลี่ยนไม่ได้
          </p>
        </div>

        {result.serverError && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            {result.serverError}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-cream-200 bg-white p-4">
        <div className="mx-auto max-w-[480px]">
          <Button
            full
            loading={isPending}
            disabled={!name.trim() || name === initialName}
            onClick={() => execute({ name: name.trim() })}
          >
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}
