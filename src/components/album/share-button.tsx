"use client";

import { useState } from "react";
import { Download, Loader2, Share2 } from "lucide-react";

/**
 * แชร์/บันทึกไฟล์ผ่านแผงแชร์ของเครื่อง
 *
 * ใช้ navigator.share แทนการทำ "ลิงก์แชร์สาธารณะ" ของเราเอง เพราะ
 * - ลิงก์สาธารณะแปลว่าไฟล์สุขภาพเปิดได้โดยไม่ต้องล็อกอิน ซึ่งเป็นการตัดสินใจ
 *   เรื่องความเป็นส่วนตัวที่ใหญ่เกินกว่าจะแถมมากับปุ่มแชร์
 * - แผงของเครื่องให้ทุกอย่างที่คนอยากได้จริงอยู่แล้ว: เซฟลงคลังรูป ส่ง LINE
 *   ส่งข้อความ AirDrop โดยที่ไฟล์ไม่เคยออกจากเครื่องผู้ใช้ไปไหนนอกจากที่เขาเลือก
 *
 * เครื่องที่ไม่มี navigator.share (เดสก์ท็อปส่วนใหญ่) ตกไปเป็นดาวน์โหลดแทน
 * ซึ่งเป็นสิ่งที่คนบนเดสก์ท็อปตั้งใจจะทำอยู่แล้ว
 *
 * ดึงไฟล์ผ่าน /api/media ของแอปเอง ไม่ใช่ผ่าน worker เสิร์ฟไฟล์ เพราะ
 * worker นั้นอยู่คนละ origin และไม่ได้เปิด CORS ไว้ (ตั้งใจ) fetch จึงอ่านไม่ได้
 */
export function ShareButton({
  r2Key,
  filename,
  title,
}: {
  r2Key: string;
  filename: string;
  title: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/media/${r2Key}`);
      if (!res.ok) throw new Error(String(res.status));
      const blob = await res.blob();
      const file = new File([blob], filename, { type: blob.type });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title });
        return;
      }

      // ทางถอย: ดาวน์โหลดลงเครื่อง
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      // ปล่อยคืนทันทีไม่ได้ Safari ยังอ่าน url อยู่ตอนเริ่มดาวน์โหลด
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    } catch (e) {
      // ผู้ใช้กดยกเลิกแผงแชร์ ไม่ใช่ข้อผิดพลาด อย่าขึ้นข้อความให้ตกใจ
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("แชร์ไฟล์ไม่สำเร็จ ลองใหม่อีกครั้ง");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-1.5">
      <button
        type="button"
        disabled={busy}
        onClick={run}
        className="flex h-11 items-center justify-center gap-2 rounded-md border border-cream-200 bg-white text-sm font-medium text-ink-900"
      >
        {busy ? (
          <Loader2 size={17} strokeWidth={1.9} className="animate-spin" />
        ) : (
          <Share2 size={17} strokeWidth={1.9} />
        )}
        แชร์ / บันทึกลงเครื่อง
      </button>
      {error && <p className="text-center text-xs text-danger">{error}</p>}
    </div>
  );
}

/**
 * ปุ่มดาวน์โหลดตรงๆ สำหรับกรณีที่ไฟล์ใหญ่เกินกว่าจะอ่านเข้าหน่วยความจำก่อนแชร์
 *
 * คลิป 500 MB ถ้าโหลดเป็น blob ทั้งก้อนก่อน แท็บจะกินแรมเท่านั้นและมีโอกาส
 * ถูกเบราว์เซอร์ฆ่าทิ้งบนมือถือ — เส้นทางนี้ให้เบราว์เซอร์สตรีมลงดิสก์เอง
 */
export function DownloadLink({ r2Key }: { r2Key: string }) {
  return (
    <a
      // ชื่อไฟล์ฝั่ง server เป็นคนตั้ง ไม่ส่งมาจาก URL (กัน CRLF injection ใน header)
      href={`/api/media/${r2Key}?download=1`}
      download
      className="flex h-11 items-center justify-center gap-2 rounded-md border border-cream-200 bg-white text-sm font-medium text-ink-900"
    >
      <Download size={17} strokeWidth={1.9} />
      บันทึกลงเครื่อง
    </a>
  );
}
