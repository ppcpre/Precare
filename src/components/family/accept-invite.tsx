"use client";

import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Button } from "@/components/ui/button";
import { acceptInvite } from "@/actions/invites";

export function AcceptInvite({ token }: { token: string }) {
  const router = useRouter();
  const { execute, isPending, result } = useAction(acceptInvite, {
    onSuccess: () => {
      // เข้า dashboard ของ family นั้นเลย ไม่ต้องผ่าน onboarding
      router.push("/dashboard");
      router.refresh();
    },
  });

  return (
    <div className="flex flex-col gap-2">
      {result.serverError && (
        <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
          {result.serverError}
        </p>
      )}
      <Button full loading={isPending} onClick={() => execute({ token })}>
        เข้าร่วมครอบครัว
      </Button>
      <Button variant="ghost" onClick={() => router.push("/")}>
        ปฏิเสธคำเชิญ
      </Button>
    </div>
  );
}
