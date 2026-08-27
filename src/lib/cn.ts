/**
 * ตัวช่วยรวม className — เขียนเอง 3 บรรทัดแทนการลง clsx + tailwind-merge
 * เพราะเหลือ budget bundle แค่ ~1.35 MiB จากเพดาน 3 MiB
 *
 * ⚠️ กับดัก: ตัวนี้แค่ต่อสตริง ไม่ได้ merge class ที่ชนกันเหมือน tailwind-merge
 *    ส่ง "hidden" ไปทับ component ที่มี "inline-flex" เป็น base จะไม่ได้ผล
 *    เพราะทั้งคู่อยู่ใน class list แล้วลำดับใน CSS เป็นตัวตัดสิน ไม่ใช่ลำดับที่เขียน
 *    เคยทำให้ปุ่มบนหน้า list โผล่บนมือถือคู่กับ FAB มาแล้วทั้งสามหน้า
 *    ถ้าต้องคุม display ตามขนาดจอ ให้ครอบด้วย element ชั้นนอกแทน
 */
export type ClassValue = string | false | null | undefined;
export const cn = (...v: ClassValue[]) => v.filter(Boolean).join(" ");
