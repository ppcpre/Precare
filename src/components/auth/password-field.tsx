"use client";

import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Field } from "@/components/ui/field";

/** ช่องรหัสผ่าน + ปุ่มตา toggle ตามที่ออกแบบไว้ในหน้า login */
export function PasswordField({
  label = "รหัสผ่าน",
  name,
  autoComplete,
  error,
  hint,
  onValueChange,
}: {
  label?: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  error?: string;
  hint?: string;
  onValueChange?: (v: string) => void;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Field
        label={label}
        name={name}
        type={show ? "text" : "password"}
        autoComplete={autoComplete}
        required
        minLength={8}
        error={error}
        hint={hint}
        onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
        className="pr-11"
      />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
        className="absolute right-1 top-[30px] flex size-9 min-h-0 items-center justify-center rounded-sm text-ink-400 hover:text-ink-600"
      >
        {show ? <EyeOff size={18} strokeWidth={1.8} /> : <Eye size={18} strokeWidth={1.8} />}
      </button>
    </div>
  );
}
