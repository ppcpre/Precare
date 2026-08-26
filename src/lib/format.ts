/** จัดรูปแบบวันที่/ตัวเลขแบบไทย — pure function ไม่มี state ใช้ได้ทั้ง server และ client */
const M_SHORT = "ม.ค. ก.พ. มี.ค. เม.ย. พ.ค. มิ.ย. ก.ค. ส.ค. ก.ย. ต.ค. พ.ย. ธ.ค.".split(" ");
const M_FULL =
  "มกราคม กุมภาพันธ์ มีนาคม เมษายน พฤษภาคม มิถุนายน กรกฎาคม สิงหาคม กันยายน ตุลาคม พฤศจิกายน ธันวาคม".split(" ");

/** 12 ส.ค. */
export const dayMonth = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${M_SHORT[d.getMonth()]}`;
};

/** 12 ส.ค. 2569 — ปี พ.ศ. */
export const thaiDate = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${M_SHORT[d.getMonth()]} ${d.getFullYear() + 543}`;
};

/** 12 สิงหาคม 2569 */
export const thaiDateFull = (iso: string) => {
  const d = new Date(iso);
  return `${d.getDate()} ${M_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
};

/** 14:30 */
export const timeOf = (iso: string) => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};

export const monthShort = (iso: string) => M_SHORT[new Date(iso).getMonth()];
export const dayOf = (iso: string) => new Date(iso).getDate();

/** ความดันเกินเกณฑ์ — แสดงแบบหม่น ไม่ใช่แถบแดงทั้งการ์ด (design principle ข้อ 3) */
export const isHighBp = (sys: number | null, dia: number | null) =>
  (sys != null && sys >= 140) || (dia != null && dia >= 90);
