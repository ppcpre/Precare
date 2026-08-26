import { AlertTriangle } from "lucide-react";
import { formatBytes, type StorageUsage } from "@/lib/storage";

/**
 * ป้ายเตือนโควตาพื้นที่ — โผล่เมื่อใช้ไปถึง 4 GB และเปลี่ยนเป็นสีแดงเมื่อเต็ม 5 GB
 * แสดงในทุกหน้าผ่าน layout เพื่อให้เห็นก่อนจะอัปโหลดไม่ได้
 */
export function StorageNotice({ usage }: { usage: StorageUsage }) {
  if (!usage.warn) return null;

  return (
    <div
      role="status"
      className={`flex items-center gap-2.5 border-b px-4 py-2.5 ${
        usage.full ? "border-danger bg-cream-100" : "border-cream-200 bg-cream-100"
      }`}
    >
      <AlertTriangle
        size={18}
        strokeWidth={1.9}
        className={usage.full ? "shrink-0 text-danger" : "shrink-0 text-warning"}
      />
      <p className="flex-1 text-[13px] leading-relaxed text-ink-600">
        {usage.full ? (
          <>
            <span className="font-medium text-danger">พื้นที่เก็บไฟล์เต็มแล้ว</span> — อัปโหลดรูปใหม่ไม่ได้
            จนกว่าจะลบไฟล์เก่าออก
          </>
        ) : (
          <>
            <span className="font-medium text-ink-900">พื้นที่เก็บไฟล์ใกล้เต็ม</span> — ใช้ไป{" "}
            {formatBytes(usage.usedBytes)} จาก {formatBytes(usage.limitBytes)}
          </>
        )}
      </p>
      <span className="shrink-0 font-mono text-xs text-ink-400">
        {Math.round(usage.percent)}%
      </span>
    </div>
  );
}
