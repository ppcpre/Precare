import type { CARE_GROUP_COLORS } from "@/db/schema";

type Color = (typeof CARE_GROUP_COLORS)[number];

/**
 * สีของกลุ่มการรักษา — map เป็นคลาส Tailwind ที่เขียนเต็มคำ
 * ห้ามประกอบชื่อคลาสด้วยสตริง (`bg-${c}-100`) เพราะ Tailwind สแกนไฟล์
 * หาคลาสตอน build จะหาไม่เจอแล้วสีหายไปเงียบๆ
 */
const MAP: Record<Color, { dot: string; chip: string }> = {
  peach: { dot: "bg-peach-500", chip: "bg-peach-100 text-peach-700" },
  sky: { dot: "bg-sky-500", chip: "bg-sky-100 text-sky-700" },
  sage: { dot: "bg-sage-500", chip: "bg-sage-100 text-sage-700" },
  plum: { dot: "bg-plum-500", chip: "bg-plum-100 text-plum-700" },
  clay: { dot: "bg-brown-300", chip: "bg-cream-200 text-ink-600" },
};

const FALLBACK = MAP.clay;

export const groupColor = (c: string | null | undefined) =>
  (c && MAP[c as Color]) || FALLBACK;
