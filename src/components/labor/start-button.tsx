"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startLaborSession } from "@/actions/labor";
import { localIso } from "@/lib/labor";

export function StartLaborButton() {
  const router = useRouter();
  const { execute, isPending, result } = useAction(startLaborSession, {
    onSuccess: () => router.refresh(),
  });

  return (
    <div className="flex flex-col gap-2">
      {result.serverError && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          {result.serverError}
        </p>
      )}
      <Button full loading={isPending} onClick={() => execute({ at: localIso() })}>
        <Play size={18} strokeWidth={2} />
        เริ่มจับเวลา
      </Button>
    </div>
  );
}
