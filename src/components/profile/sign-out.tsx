"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { signOut } from "@/lib/auth-client";

export function SignOutRow() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        await signOut();
        router.push("/login");
        router.refresh();
      }}
      className="flex h-auto min-h-0 w-full items-center gap-3 p-4 text-left disabled:opacity-60"
    >
      <LogOut size={20} strokeWidth={1.9} className="shrink-0 text-danger" />
      <span className="font-medium text-danger">{pending ? "กำลังออก…" : "ออกจากระบบ"}</span>
    </button>
  );
}
