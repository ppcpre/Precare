import type { MilestoneKind } from "@/db/schema";

/**
 * หมุดพัฒนาการที่ให้ปักได้ เรียงตามลำดับที่มักเกิดจริง
 *
 * `typicalMonths` คือช่วงอายุที่พบได้บ่อย เอาไว้แสดงเป็นคำใบ้เฉยๆ
 *
 * ⚠️ ห้ามเอาไปใช้ตัดสินว่า "ช้ากว่าเกณฑ์" — เด็กปกติคร่อมช่วงนี้ได้กว้างมาก
 *    การขึ้นข้อความว่าลูกพัฒนาการช้าต้องให้บุคลากรทางการแพทย์ตรวจถ้อยคำก่อน
 */
export const MILESTONES: {
  kind: MilestoneKind;
  label: string;
  typicalMonths: [number, number];
}[] = [
  { kind: "neck", label: "คอแข็ง ชันคอได้", typicalMonths: [2, 4] },
  { kind: "roll", label: "พลิกคว่ำพลิกหงาย", typicalMonths: [4, 6] },
  { kind: "sit", label: "นั่งได้เอง", typicalMonths: [6, 9] },
  { kind: "tooth", label: "ฟันซี่แรก", typicalMonths: [6, 12] },
  { kind: "crawl", label: "คลาน", typicalMonths: [7, 10] },
  { kind: "stand", label: "เกาะยืน", typicalMonths: [9, 12] },
  { kind: "walk", label: "เดินได้เอง", typicalMonths: [9, 18] },
  { kind: "word", label: "พูดคำแรก", typicalMonths: [10, 18] },
];

export const MILESTONE_LABEL: Record<MilestoneKind, string> = Object.fromEntries(
  MILESTONES.map((m) => [m.kind, m.label]),
) as Record<MilestoneKind, string>;
