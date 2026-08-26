/**
 * ตัวช่วยรวม className — เขียนเอง 3 บรรทัดแทนการลง clsx + tailwind-merge
 * เพราะเหลือ budget bundle แค่ ~1.35 MiB จากเพดาน 3 MiB
 */
export type ClassValue = string | false | null | undefined;
export const cn = (...v: ClassValue[]) => v.filter(Boolean).join(" ");
