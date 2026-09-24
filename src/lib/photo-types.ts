/**
 * ชื่อไทยของประเภทไฟล์ — แหล่งเดียวของทั้งแอป
 *
 * เดิมกระจายอยู่ห้าที่ (หน้าอัลบั้ม, ไทล์, การ์ด, หน้ารูป, ชีทอัปโหลด)
 * เพิ่มประเภทใหม่ทีหนึ่งต้องไล่แก้ครบทุกที่ ลืมที่เดียวคือมีที่นึงขึ้นว่า
 * "document" เป็นภาษาอังกฤษโดยไม่มีใครเห็นจนกว่าผู้ใช้จะเจอ
 *
 * ⚠️ `import type` เท่านั้น ห้าม import ค่าจริงจาก @/db/schema
 *    ไฟล์นี้ถูก client component ใช้ด้วย (ชีทอัปโหลด, ตัวเลือกประเภท)
 *    ถ้าดึงค่าจริงมา จะลาก drizzle ทั้งก้อนเข้า bundle ฝั่งเบราว์เซอร์
 *    ส่วน type ถูกลบทิ้งตอน compile จึงไม่ติดอะไรไปด้วย
 *    และยังได้ความปลอดภัยเต็ม — เพิ่มประเภทใน schema แล้วไม่ใส่ชื่อไทยที่นี่
 *    จะขึ้น type error ทันที
 */
import type { AlbumPhotoType, PhotoType } from "@/db/schema";

export const TYPE_LABEL: Record<PhotoType, string> = {
  ultrasound: "อัลตราซาวด์",
  family: "ครอบครัว",
  document: "เอกสาร",
  other: "อื่นๆ",
  receipt: "ใบเสร็จ",
};

/** ตัวเลือกที่ให้ผู้ใช้เลือกได้ในอัลบั้ม (ไม่รวมใบเสร็จ ซึ่งเข้าได้ทางนัดหมายเท่านั้น) */
export const ALBUM_TYPE_OPTIONS: { value: AlbumPhotoType; label: string }[] = [
  { value: "ultrasound", label: TYPE_LABEL.ultrasound },
  { value: "family", label: TYPE_LABEL.family },
  { value: "document", label: TYPE_LABEL.document },
  { value: "other", label: TYPE_LABEL.other },
];

/** ไทล์ในกริดไม่ขึ้นป้ายให้ "อื่นๆ" — ป้ายที่ไม่บอกอะไรคือสิ่งรบกวนสายตา */
export const tileLabel = (type: string) =>
  type === "other" ? "" : (TYPE_LABEL[type as PhotoType] ?? "");
