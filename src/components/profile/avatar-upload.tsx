"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Camera, Loader2 } from "lucide-react";
import { Avatar } from "@/components/app-topbar";
import { removeAvatar, uploadAvatar } from "@/actions/profile";

const MAX_EDGE = 512;

/**
 * ย่อรูปในเบราว์เซอร์ก่อนอัปโหลด
 *
 * สำคัญกับโควตา: รูปจากมือถือใบละ 3–5 MB ถ้าส่งดิบๆ จะกิน 5 GB หมดเร็วมาก
 * ย่อเหลือด้านยาว 512px + webp คุณภาพ 0.85 เหลือราว 30–60 KB
 */
async function resizeToWebp(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("เบราว์เซอร์นี้ไม่รองรับการย่อรูป");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const blob = await new Promise<Blob | null>((res) =>
    canvas.toBlob(res, "image/webp", 0.85),
  );
  if (!blob) throw new Error("ย่อรูปไม่สำเร็จ");
  return blob;
}

export function AvatarUpload({
  name,
  image,
  storageFull,
}: {
  name: string;
  image: string | null;
  storageFull: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const done = () => {
    setBusy(false);
    setPreview(null);
    router.refresh();
  };
  const upload = useAction(uploadAvatar, {
    onSuccess: done,
    onError: ({ error: e }) => {
      setError(e.serverError ?? "อัปโหลดไม่สำเร็จ");
      setBusy(false);
      setPreview(null);
    },
  });
  const remove = useAction(removeAvatar, { onSuccess: done });

  async function onPick(file: File) {
    setError(null);
    setBusy(true);
    try {
      const blob = await resizeToWebp(file);
      setPreview(URL.createObjectURL(blob));
      const fd = new FormData();
      fd.append("file", new File([blob], "avatar.webp", { type: "image/webp" }));
      upload.execute(fd);
    } catch (e) {
      setError(e instanceof Error ? e.message : "อ่านไฟล์ไม่สำเร็จ");
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <button
        type="button"
        disabled={busy || storageFull}
        onClick={() => inputRef.current?.click()}
        aria-label="เปลี่ยนรูปโปรไฟล์"
        className="relative h-auto min-h-0 rounded-full disabled:opacity-60"
      >
        <Avatar name={name} image={preview ?? image} size={104} />
        <span
          aria-hidden
          className="absolute -bottom-0.5 -right-0.5 flex size-8 items-center justify-center rounded-full border-2 border-white bg-brown-700"
        >
          {busy ? (
            <Loader2 size={15} strokeWidth={2} className="animate-spin text-white" />
          ) : (
            <Camera size={15} strokeWidth={1.9} className="text-white" />
          )}
        </span>
      </button>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) void onPick(f);
        }}
      />

      {storageFull ? (
        <p className="text-center text-xs text-danger">
          พื้นที่เก็บไฟล์เต็ม อัปโหลดรูปใหม่ไม่ได้
        </p>
      ) : (
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={() => inputRef.current?.click()}
            className="h-auto min-h-0 text-sm font-medium text-brown-700"
          >
            เลือกรูป
          </button>
          {image && (
            <>
              <span aria-hidden className="text-ink-400">·</span>
              <button
                type="button"
                disabled={remove.isPending}
                onClick={() => remove.execute({})}
                className="h-auto min-h-0 text-sm text-ink-400 hover:text-danger"
              >
                ลบรูป
              </button>
            </>
          )}
        </div>
      )}

      <p className="text-center text-xs text-ink-400">
        ระบบย่อรูปให้อัตโนมัติเหลือด้านยาว 512px เพื่อประหยัดพื้นที่
      </p>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}
