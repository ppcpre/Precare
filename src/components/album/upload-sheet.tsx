"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { Camera, Plus, User as UserIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { addPhotos } from "@/actions/photos";
import { PHOTO_EDGE, formatBytesShort, resizeToWebp } from "@/lib/image";
import { cn } from "@/lib/cn";

const TYPES = [
  { value: "ultrasound", label: "อัลตราซาวด์" },
  { value: "family", label: "ครอบครัว" },
  { value: "other", label: "อื่นๆ" },
] as const;

const MAX_BATCH = 10;
/** ต้องต่ำกว่า serverActions.bodySizeLimit ใน next.config.ts เผื่อ overhead ของ multipart */
const MAX_BATCH_BYTES = 16 * 1024 ** 2;
type Picked = { blob: Blob; url: string };

export function UploadSheet({
  uploaderName,
  storageFull,
  logId,
}: {
  uploaderName: string;
  storageFull: boolean;
  logId?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("ultrasound");
  const [takenAt, setTakenAt] = useState(new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [pinned, setPinned] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute, isPending, result } = useAction(addPhotos, {
    onSuccess: () => {
      picked.forEach((p) => URL.revokeObjectURL(p.url));
      router.push("/album");
      router.refresh();
    },
  });

  const totalBytes = picked.reduce((n, p) => n + p.blob.size, 0);

  async function onPick(files: File[]) {
    setError(null);
    setResizing(true);
    const room = MAX_BATCH - picked.length;
    const list = files.slice(0, room);
    const notes: string[] = [];
    if (files.length > room) notes.push(`เพิ่มได้ครั้งละไม่เกิน ${MAX_BATCH} รูป`);

    // ย่อทีละใบและกันพังแยกใบ ถ้า catch คลุมทั้ง loop ไฟล์ที่ย่อสำเร็จ
    // ก่อนหน้าจะหายไปด้วย ซึ่งผู้ใช้ไม่เข้าใจว่าทำไมเลือก 5 ใบแล้วไม่ขึ้นสักใบ
    const out: Picked[] = [];
    for (const f of list) {
      try {
        const blob = await resizeToWebp(f, PHOTO_EDGE);
        out.push({ blob, url: URL.createObjectURL(blob) });
      } catch {
        notes.push(`เปิดไฟล์ ${f.name} ไม่ได้ (รองรับ JPG, PNG, WebP)`);
      }
    }
    setPicked((cur) => [...cur, ...out]);
    setError(notes.length ? notes.join(" · ") : null);
    setResizing(false);
  }

  function submit() {
    if (totalBytes > MAX_BATCH_BYTES) {
      setError(`รูปรวมกัน ${formatBytesShort(totalBytes)} ใหญ่เกินไป ลองลดจำนวนรูปลง`);
      return;
    }
    const fd = new FormData();
    picked.forEach((p, i) => fd.append("files", new File([p.blob], `p${i}.webp`, { type: "image/webp" })));
    fd.set("takenAt", takenAt);
    fd.set("type", type);
    fd.set("caption", caption);
    fd.set("pinned", String(pinned));
    if (logId) fd.set("logId", logId);
    execute(fd);
  }

  return (
    <div className="flex min-h-dvh flex-col bg-cream-50">
      <header className="flex h-14 items-center gap-1 border-b border-cream-200 bg-white px-2">
        <button
          type="button"
          onClick={() => router.back()}
          aria-label="ปิด"
          className="flex size-11 items-center justify-center rounded-sm text-ink-600 hover:bg-cream-100"
        >
          <X size={22} strokeWidth={1.8} />
        </button>
        <h1 className="font-semibold text-ink-900">เพิ่มรูปเข้าอัลบั้ม</h1>
      </header>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 p-4">
        {storageFull && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            พื้นที่เก็บไฟล์เต็มแล้ว ลบรูปเก่าออกก่อนจึงจะเพิ่มรูปใหม่ได้
          </p>
        )}

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600">รูปที่เลือก</span>
            {picked.length > 0 && (
              <span className="text-xs text-ink-400">
                {picked.length} รูป · รวม {formatBytesShort(totalBytes)}
              </span>
            )}
          </div>

          <div className="flex flex-wrap gap-2">
            {picked.map((p, i) => (
              <div key={p.url} className="relative size-24 shrink-0">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ในเครื่อง ยังไม่ได้อัปโหลด */}
                <img src={p.url} alt="" className="size-full rounded-[10px] object-cover" />
                <button
                  type="button"
                  aria-label={`เอารูปที่ ${i + 1} ออก`}
                  onClick={() => {
                    URL.revokeObjectURL(p.url);
                    setPicked((cur) => cur.filter((x) => x !== p));
                  }}
                  className="absolute right-1 top-1 flex size-5 min-h-0 items-center justify-center rounded-full bg-[rgba(43,36,32,0.7)]"
                >
                  <X size={12} strokeWidth={2.4} className="text-white" />
                </button>
              </div>
            ))}

            {picked.length < MAX_BATCH && !storageFull && (
              <button
                type="button"
                disabled={resizing}
                onClick={() => inputRef.current?.click()}
                className="flex size-24 min-h-0 shrink-0 flex-col items-center justify-center gap-1 rounded-[10px] border-[1.5px] border-dashed border-brown-300 bg-cream-50"
              >
                {resizing ? (
                  <span className="size-5 animate-spin rounded-full border-2 border-brown-500 border-t-transparent" />
                ) : (
                  <Camera size={22} strokeWidth={1.7} className="text-brown-500" />
                )}
                <span className="text-xs text-ink-600">{picked.length ? "เพิ่ม" : "เลือกรูป"}</span>
              </button>
            )}
          </div>

          <p className="text-xs text-ink-400">
            ระบบย่อรูปให้อัตโนมัติก่อนอัปโหลด เพื่อประหยัดพื้นที่
          </p>
          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          className="hidden"
          onChange={(e) => {
            // ต้อง copy ออกมาเป็น array ก่อน แล้วค่อยล้าง input
            // FileList เป็น live object ตัวเดียวกับ input.files การ set value=""
            // จะล้างมันทิ้งไปด้วย ถ้าถือ reference ไว้เฉยๆ จะได้ list ว่าง
            const files = Array.from(e.target.files ?? []);
            e.target.value = "";
            if (files.length) void onPick(files);
          }}
        />

        <div className="flex flex-col gap-2">
          <span className="text-sm text-ink-600">ประเภท</span>
          <div className="flex flex-wrap gap-1.5">
            {TYPES.map((t) => (
              <Chip key={t.value} active={type === t.value} onClick={() => setType(t.value)}>
                {t.label}
              </Chip>
            ))}
          </div>
        </div>

        <Field
          label="วันที่ถ่าย"
          type="date"
          value={takenAt}
          onChange={(e) => setTakenAt(e.target.value)}
          max={new Date().toISOString().slice(0, 10)}
          hint="ไม่ใช่วันที่อัปโหลด — ระบบใช้วันที่นี้จัดกลุ่มตามสัปดาห์"
        />

        <Textarea
          label="คำบรรยาย"
          rows={2}
          placeholder="เช่น คุณหมอบอกว่าลูกโตตามเกณฑ์ หนัก 700 กรัมแล้ว"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          maxLength={500}
        />

        <div className="flex items-center gap-3">
          <button
            type="button"
            role="switch"
            aria-checked={pinned}
            aria-label="ปักหมุดเป็นรูปเด่นของสัปดาห์"
            onClick={() => setPinned((v) => !v)}
            className={cn(
              "flex h-6.5 w-11 min-h-0 shrink-0 items-center rounded-full p-[3px] transition-colors",
              pinned ? "justify-end bg-brown-700" : "justify-start bg-cream-200",
            )}
          >
            <span className="size-5 rounded-full bg-white" />
          </button>
          <span className="flex flex-col">
            <span className="text-ink-900">ปักหมุดเป็นรูปเด่นของสัปดาห์</span>
            <span className="text-xs text-ink-600">
              ใช้เป็นรูปหน้าปกของสัปดาห์นี้ · ปักให้รูปแรกของชุด
            </span>
          </span>
        </div>

        <p className="flex items-center gap-1.5 text-xs text-ink-400">
          <UserIcon size={13} strokeWidth={1.9} />
          เพิ่มโดย {uploaderName} · บันทึกอัตโนมัติ
        </p>

        {result.serverError && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            {result.serverError}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-cream-200 bg-white p-4">
        <div className="mx-auto max-w-[560px]">
          <Button
            full
            loading={isPending}
            disabled={picked.length === 0 || storageFull || resizing}
            onClick={submit}
          >
            <Plus size={18} strokeWidth={2} />
            {picked.length ? `เพิ่ม ${picked.length} รูปเข้าอัลบั้ม` : "เลือกรูปก่อน"}
          </Button>
        </div>
      </div>
    </div>
  );
}
