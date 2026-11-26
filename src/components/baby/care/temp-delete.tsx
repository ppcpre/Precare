"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Trash2 } from "lucide-react";
import { deleteChildTemp } from "@/actions/child-care";

export function TempDelete({ tempId, label }: { tempId: string; label: string }) {
  const router = useRouter();
  const del = useAction(deleteChildTemp, { onSuccess: () => router.refresh() });
  return (
    <button
      type="button"
      aria-label={`ลบ ${label}`}
      disabled={del.isPending}
      onClick={() => {
        if (confirm(`ลบ ${label}?`)) del.execute({ tempId });
      }}
      className="flex size-11 shrink-0 items-center justify-center rounded-full text-ink-400 hover:bg-cream-100 hover:text-danger"
    >
      <Trash2 size={17} strokeWidth={1.9} />
    </button>
  );
}
