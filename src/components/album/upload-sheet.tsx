"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAction } from "next-safe-action/hooks";
import { AlertCircle, Camera, Film, Image as ImageIcon, Play, Plus, User as UserIcon, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Textarea } from "@/components/ui/field";
import { Chip } from "@/components/ui/chip";
import { addPhotos, addVideo } from "@/actions/photos";
import { PHOTO_EDGE, formatBytesShort, resizeToWebp } from "@/lib/image";
import { VIDEO_HELP, VIDEO_MIME, formatClip, posterFrame, probeVideo } from "@/lib/video";
import { cn } from "@/lib/cn";

const TYPES = [
  { value: "ultrasound", label: "อัลตราซาวด์" },
  { value: "family", label: "ครอบครัว" },
  { value: "other", label: "อื่นๆ" },
] as const;

const MAX_BATCH = 10;
/** ต้องต่ำกว่า serverActions.bodySizeLimit ใน next.config.ts เผื่อ overhead ของ multipart */
const MAX_BATCH_BYTES = 16 * 1024 ** 2;

/** ค่าเดียวกับฝั่ง server ใน src/lib/storage.ts — ตรงนี้ไว้ปฏิเสธก่อนเสียเวลาอัปโหลด */
const MAX_VIDEO_BYTES = 40 * 1024 ** 2;
const MAX_VIDEO_MS = 30_000;

/**
 * คลิปละหนึ่งต่อครั้ง
 *
 * ไม่ใช่ข้อจำกัดทางเทคนิค แต่คลิปหนึ่งกินพื้นที่เท่ารูปสองร้อยใบ
 * และโควตาเป็นก้อนเดียวกันทั้งแอป การให้เลือกทีละคลิปทำให้ทุกครั้ง
 * ที่เพิ่มคลิปเป็นการตัดสินใจ ไม่ใช่การกวาดเลือกทั้งอัลบั้มในเครื่อง
 */
type Picked = { blob: Blob; url: string };
type Video = { file: File; url: string; poster: Blob; posterUrl: string; durationMs: number };

export function UploadSheet({
  uploaderName,
  storageFull,
  logId,
  appointmentId,
  initialTakenAt,
}: {
  uploaderName: string;
  storageFull: boolean;
  logId?: string;
  appointmentId?: string;
  initialTakenAt?: string;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [picked, setPicked] = useState<Picked[]>([]);
  const [video, setVideo] = useState<Video | null>(null);
  const [type, setType] = useState<(typeof TYPES)[number]["value"]>("ultrasound");
  const [takenAt, setTakenAt] = useState(initialTakenAt ?? new Date().toISOString().slice(0, 10));
  const [caption, setCaption] = useState("");
  const [pinned, setPinned] = useState(false);
  const [resizing, setResizing] = useState(false);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const photosAction = useAction(addPhotos);
  const videoAction = useAction(addVideo);
  const serverError = photosAction.result.serverError ?? videoAction.result.serverError;

  const totalBytes = picked.reduce((n, p) => n + p.blob.size, 0) + (video?.file.size ?? 0);
  const count = picked.length + (video ? 1 : 0);

  async function onPick(files: File[]) {
    setError(null);
    setResizing(true);
    const notes: string[] = [];

    const vids = files.filter((f) => f.type.startsWith("video/"));
    const imgs = files.filter((f) => !f.type.startsWith("video/"));

    for (const f of vids) {
      if (video) {
        notes.push("เพิ่มได้ครั้งละหนึ่งคลิป");
        break;
      }
      if (!VIDEO_MIME.includes(f.type)) {
        // .mov จาก iPhone เปิดไม่ได้ทุกเครื่อง บอกวิธีตั้งกล้องไปด้วยเลย
        // ไม่งั้นคนจะลองใหม่ด้วยไฟล์เดิมแล้วเจอข้อความเดิมวนไป
        notes.push(`${f.name} ไม่ใช่ mp4 — ${VIDEO_HELP}`);
        continue;
      }
      if (f.size > MAX_VIDEO_BYTES) {
        notes.push(`${f.name} ใหญ่ ${formatBytesShort(f.size)} เกิน ${formatBytesShort(MAX_VIDEO_BYTES)}`);
        continue;
      }
      try {
        const info = await probeVideo(f);
        if (info.durationMs > MAX_VIDEO_MS) {
          notes.push(
            `${f.name} ยาว ${formatClip(info.durationMs)} เกิน ${MAX_VIDEO_MS / 1000} วินาที`,
          );
          continue;
        }
        const poster = await posterFrame(f);
        setVideo({
          file: f,
          url: URL.createObjectURL(f),
          poster,
          posterUrl: URL.createObjectURL(poster),
          durationMs: info.durationMs,
        });
      } catch (e) {
        notes.push(e instanceof Error ? `${f.name}: ${e.message}` : `เปิด ${f.name} ไม่ได้`);
      }
    }

    const room = MAX_BATCH - picked.length;
    const list = imgs.slice(0, room);
    if (imgs.length > room) notes.push(`เพิ่มได้ครั้งละไม่เกิน ${MAX_BATCH} รูป`);

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

  /**
   * ส่งคลิปด้วย XHR ไม่ใช่ fetch
   *
   * fetch ยังบอกความคืบหน้าของ "ขาขึ้น" ไม่ได้ในเบราว์เซอร์ทั่วไป
   * คลิป 40 MB บนเน็ตมือถือใช้เวลาเป็นสิบวินาที ถ้าไม่มีตัวเลขให้ดู
   * คนจะคิดว่าค้างแล้วกดออก ซึ่งทำให้ไฟล์ค้างอยู่ใน R2 กินโควตาของทุกคน
   */
  function uploadVideo(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", "/api/media/video");
      xhr.setRequestHeader("content-type", "video/mp4");
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setUploadPct(Math.round((e.loaded / e.total) * 100));
      };
      xhr.onload = () => {
        let body: { key?: string; error?: string } = {};
        try {
          body = JSON.parse(xhr.responseText);
        } catch {
          /* ตอบไม่ใช่ JSON = พังนอกเหนือที่เราคุม ใช้ข้อความกลางแทน */
        }
        if (xhr.status === 200 && body.key) resolve(body.key);
        else reject(new Error(body.error ?? "อัปโหลดคลิปไม่สำเร็จ"));
      };
      xhr.onerror = () => reject(new Error("การเชื่อมต่อหลุดระหว่างอัปโหลดคลิป"));
      xhr.send(file);
    });
  }

  async function submit() {
    if (totalBytes - (video?.file.size ?? 0) > MAX_BATCH_BYTES) {
      setError(`รูปรวมกันใหญ่เกินไป ลองลดจำนวนรูปลง`);
      return;
    }
    setError(null);
    setBusy(true);
    try {
      if (picked.length) {
        const fd = new FormData();
        picked.forEach((p, i) =>
          fd.append("files", new File([p.blob], `p${i}.webp`, { type: "image/webp" })),
        );
        fd.set("takenAt", takenAt);
        fd.set("type", type);
        fd.set("caption", caption);
        fd.set("pinned", String(pinned));
        if (logId) fd.set("logId", logId);
        if (appointmentId) fd.set("appointmentId", appointmentId);
        const res = await photosAction.executeAsync(fd);
        if (res?.serverError || res?.validationErrors) return;
      }

      if (video) {
        setUploadPct(0);
        const key = await uploadVideo(video.file);
        const fd = new FormData();
        fd.set("key", key);
        fd.set("takenAt", takenAt);
        fd.set("type", type);
        fd.set("caption", caption);
        fd.set("durationMs", String(video.durationMs));
        fd.append("poster", new File([video.poster], "poster.webp", { type: "image/webp" }));
        if (logId) fd.set("logId", logId);
        if (appointmentId) fd.set("appointmentId", appointmentId);
        const res = await videoAction.executeAsync(fd);
        if (res?.serverError || res?.validationErrors) return;
      }

      picked.forEach((p) => URL.revokeObjectURL(p.url));
      if (video) {
        URL.revokeObjectURL(video.url);
        URL.revokeObjectURL(video.posterUrl);
      }
      router.push(appointmentId ? `/appointments/${appointmentId}/edit` : "/album");
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "อัปโหลดไม่สำเร็จ");
    } finally {
      setUploadPct(null);
      setBusy(false);
    }
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
        <h1 className="font-semibold text-ink-900">
          {appointmentId ? "แนบไฟล์กับนัดหมาย" : "เพิ่มลงอัลบั้ม"}
        </h1>
      </header>

      <div className="mx-auto flex w-full max-w-[560px] flex-1 flex-col gap-5 p-4">
        {storageFull && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            พื้นที่เก็บไฟล์เต็มแล้ว ลบไฟล์เก่าออกก่อนจึงจะเพิ่มใหม่ได้
          </p>
        )}

        {/* กติกาอยู่ก่อนเลือกไฟล์ ไม่ใช่โผล่ตอนโดนปฏิเสธ
            คนเลือกคลิปสองนาทีมาแล้วค่อยบอกว่ายาวเกิน คือทำให้เสียเวลาฟรี */}
        <ul className="flex flex-col gap-2 rounded-md border border-cream-200 bg-cream-100 p-3.5 text-xs leading-relaxed text-ink-600">
          <li className="flex items-start gap-2">
            <ImageIcon size={15} strokeWidth={1.9} className="mt-px shrink-0 text-ink-400" />
            รูป ย่อให้อัตโนมัติ เพิ่มได้ครั้งละไม่เกิน {MAX_BATCH} ใบ
          </li>
          <li className="flex items-start gap-2">
            <Play size={15} strokeWidth={1.9} className="mt-px shrink-0 text-ink-400" />
            วิดีโอ mp4 ยาวไม่เกิน {MAX_VIDEO_MS / 1000} วินาที และไม่เกิน{" "}
            {formatBytesShort(MAX_VIDEO_BYTES)} · ครั้งละหนึ่งคลิป
          </li>
          <li className="flex items-start gap-2">
            <AlertCircle size={15} strokeWidth={1.9} className="mt-px shrink-0 text-brown-700" />
            วิดีโอย่อไม่ได้ กินพื้นที่มากกว่ารูปราวสองร้อยเท่า
          </li>
        </ul>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-ink-600">ไฟล์ที่เลือก</span>
            {count > 0 && (
              <span className="text-xs text-ink-400">
                {count} ไฟล์ · รวม {formatBytesShort(totalBytes)}
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
                <span className="text-xs text-ink-600">{count ? "เพิ่ม" : "เลือกไฟล์"}</span>
              </button>
            )}
          </div>

          {video && (
            <div className="flex items-start gap-2.5 rounded-md border border-cream-200 bg-white p-2.5">
              <span className="relative size-14 shrink-0 overflow-hidden rounded-[9px] bg-ink-900/85">
                {/* eslint-disable-next-line @next/next/no-img-element -- blob URL ในเครื่อง */}
                <img src={video.posterUrl} alt="" className="size-full object-cover" />
                <span className="absolute inset-0 flex items-center justify-center">
                  <span className="flex size-6 items-center justify-center rounded-full bg-white/90">
                    <Play size={11} strokeWidth={2.2} className="text-ink-900" />
                  </span>
                </span>
              </span>
              <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-center justify-between gap-2">
                  <span className="truncate text-[13px] font-medium text-ink-900">
                    {video.file.name}
                  </span>
                  <span className="shrink-0 text-[11px] text-ink-400">
                    {formatBytesShort(video.file.size)}
                  </span>
                </span>
                <span className="text-[11px] text-ink-400">
                  {formatClip(video.durationMs)} ·{" "}
                  {uploadPct == null ? "พร้อมอัปโหลด" : `กำลังอัปโหลด ${uploadPct}%`}
                </span>
                {uploadPct != null && (
                  <span className="block h-1 w-full overflow-hidden rounded-full bg-cream-200">
                    <span
                      className="block h-full rounded-full bg-brown-500 transition-[width]"
                      style={{ width: `${uploadPct}%` }}
                    />
                  </span>
                )}
              </span>
              {uploadPct == null && (
                <button
                  type="button"
                  aria-label="เอาคลิปออก"
                  onClick={() => {
                    URL.revokeObjectURL(video.url);
                    URL.revokeObjectURL(video.posterUrl);
                    setVideo(null);
                  }}
                  className="flex size-6 min-h-0 shrink-0 items-center justify-center rounded-full bg-cream-200"
                >
                  <X size={13} strokeWidth={2.4} className="text-ink-600" />
                </button>
              )}
            </div>
          )}

          {!video && !storageFull && (
            <button
              type="button"
              disabled={resizing}
              onClick={() => inputRef.current?.click()}
              className="flex min-h-11 items-center justify-center gap-2 rounded-md border-[1.5px] border-dashed border-brown-300 bg-cream-50 px-3 text-sm text-ink-600"
            >
              <Film size={17} strokeWidth={1.8} className="text-brown-500" />
              เลือกคลิปสั้น
            </button>
          )}

          {error && <p className="text-xs text-danger">{error}</p>}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,video/mp4"
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

        {/* ปักหมุดใช้กับรูปเท่านั้น ไม่โชว์ตอนเลือกแต่คลิป
            ไม่งั้นจะเป็นสวิตช์ที่กดแล้วไม่เกิดอะไรขึ้น */}
        {picked.length > 0 && (
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
        )}

        <p className="flex items-center gap-1.5 text-xs text-ink-400">
          <UserIcon size={13} strokeWidth={1.9} />
          เพิ่มโดย {uploaderName} · บันทึกอัตโนมัติ
        </p>

        {serverError && (
          <p role="alert" className="rounded-sm border border-danger bg-cream-100 px-3.5 py-3 text-sm">
            {serverError}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 border-t border-cream-200 bg-white p-4">
        <div className="mx-auto max-w-[560px]">
          <Button full loading={busy} disabled={count === 0 || storageFull || resizing} onClick={submit}>
            <Plus size={18} strokeWidth={2} />
            {count ? `เพิ่ม ${count} ไฟล์` : "เลือกไฟล์ก่อน"}
          </Button>
        </div>
      </div>
    </div>
  );
}
