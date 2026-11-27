import type { Mood } from "@/types";

const PATHS: Record<Mood, string> = {
  great: "M8.4 14a4.4 4.4 0 0 0 7.2 0M8.6 9.6v.1M15.4 9.6v.1",
  good: "M8.8 13.8a4 4 0 0 0 6.4 0M8.8 9.6v.1M15.2 9.6v.1",
  okay: "M9 14.2h6M8.8 9.6v.1M15.2 9.6v.1",
  tired: "M9 14.6c1-.7 2-.7 3 0s2 .7 3 0M7.8 9.6h2.2M14 9.6h2.2",
  bad: "M8.8 15a4 4 0 0 1 6.4 0M8.8 9.6v.1M15.2 9.6v.1",
};

export const MOOD_LABEL: Record<Mood, string> = {
  great: "ดีมาก",
  good: "ดี",
  okay: "เฉยๆ",
  tired: "เหนื่อย",
  bad: "แย่",
};

/** ไอคอนหน้าแบบเส้น — ไม่ใช้ emoji ตาม design-system §5 */
export function MoodFace({ mood, size = 26, className }: { mood: Mood; size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role="img"
      aria-label={`อารมณ์: ${MOOD_LABEL[mood]}`}
    >
      <circle cx="12" cy="12" r="9" />
      <path d={PATHS[mood]} />
    </svg>
  );
}
