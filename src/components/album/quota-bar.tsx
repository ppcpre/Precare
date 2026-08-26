import { formatBytes, type StorageUsage } from "@/lib/storage";
import { Card } from "@/components/ui/card";

/**
 * แถบโควตาอยู่บนสุดของอัลบั้มโดยตั้งใจ
 * ผู้ใช้ต้องเห็นพื้นที่ที่เหลือ "ก่อน" เลือกรูป ไม่ใช่หลังโดนปฏิเสธ
 */
export function QuotaBar({ usage }: { usage: StorageUsage }) {
  return (
    <Card className="gap-1.5 p-3.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-ink-600">พื้นที่เก็บรูป</span>
        <span
          className={`text-xs font-medium ${
            usage.full ? "text-danger" : usage.warn ? "text-warning" : "text-ink-900"
          }`}
        >
          {formatBytes(usage.usedBytes)} / {formatBytes(usage.limitBytes)}
        </span>
      </div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-cream-200">
        <div
          className={`h-full rounded-full ${
            usage.full ? "bg-danger" : usage.warn ? "bg-warning" : "bg-brown-500"
          }`}
          style={{ width: `${Math.max(2, usage.percent)}%` }}
        />
      </div>
    </Card>
  );
}
