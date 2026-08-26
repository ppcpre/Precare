"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/logo";
import { signIn } from "@/lib/auth-client";

export function GoogleButton({ label, next }: { label: string; next?: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col gap-2">
      <Button
        variant="secondary"
        full
        loading={loading}
        onClick={async () => {
          setError(null);
          setLoading(true);
          const res = await signIn.social({ provider: "google", callbackURL: next ?? "/" });
          if (res?.error) {
            setError("เชื่อมต่อ Google ไม่สำเร็จ ลองใหม่อีกครั้ง");
            setLoading(false);
          }
          // สำเร็จ = เบราว์เซอร์ถูกพาไป Google ไม่ต้อง setLoading(false)
        }}
      >
        {!loading && <GoogleIcon />}
        {label}
      </Button>
      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}
