import {
  AGE_SLOTS,
  type AgeSlot,
  OVER_SLOT_ID,
  OVER_SLOT_LABEL,
  slotIdOf,
  slotStart,
} from "@/lib/child-age";

/** รูปเท่าที่ timeline ต้องใช้ — ไม่ลากทั้งแถวมา หน้านี้โหลดหลายร้อยรูป */
export interface TimelineItem {
  id: string;
  takenAt: string;
  thumbKey: string | null;
  r2Key: string;
  mediaKind: "photo" | "video";
  pinned: boolean;
  caption?: string | null;
}

export interface TimelineSlot {
  id: string;
  label: string;
  kind: AgeSlot["kind"] | "over";
  /** วันแรกของช่อง — ใช้เป็นค่าตั้งต้นของ "วันที่ถ่าย" ตอนกดอัปจากช่องว่าง */
  startsOn: string | null;
  items: TimelineItem[];
  /** รูปที่เอามาแสดงเป็นหน้าปกของช่อง */
  cover: TimelineItem | null;
}

export interface Timeline {
  slots: TimelineSlot[];
  /** จำนวนช่องที่มีรูปแล้ว จาก 26 ช่อง — ไม่นับช่อง "เกิน 3 ขวบ" */
  filled: number;
  total: number;
}

/**
 * จัดรูปลงช่องอายุ
 *
 * ช่องว่างถูกคืนมาด้วยเสมอ ไม่กรองทิ้ง — หัวใจของสมุดบันทึกเด็กคือการเห็นว่า
 * เดือนไหนยังไม่มีรูปแล้วไปเติม ถ้าคืนเฉพาะช่องที่มีรูป หน้านี้ก็กลายเป็น
 * อัลบั้มเรียงตามวันธรรมดาซึ่งมีอยู่แล้ว
 *
 * ช่อง "เกิน 3 ขวบ" ต่อท้ายเฉพาะตอนมีรูปจริง — ไม่งั้นทุกคนจะเห็นช่องว่าง
 * ของอนาคตที่ยังมาไม่ถึง
 */
export function buildTimeline(birthDate: string, items: TimelineItem[]): Timeline {
  const bySlot = new Map<string, TimelineItem[]>();

  for (const it of items) {
    const id = slotIdOf(birthDate, it.takenAt.slice(0, 10));
    /** ถ่ายก่อนวันเกิด = รูปของครรภ์ ไม่ใช่ของลูก ปล่อยตกไปเฉยๆ
     *  เกิดได้จริงเมื่อมีคนแก้วันเกิดให้ช้าลงหลังอัปรูปไปแล้ว */
    if (id === null) continue;
    const arr = bySlot.get(id) ?? [];
    arr.push(it);
    bySlot.set(id, arr);
  }

  /** ใหม่สุดอยู่หน้า และรูปที่ปักหมุดชนะเสมอ — รูปเด่นของเดือนนั้นคือสิ่งที่
   *  คนเลือกเอง ไม่ใช่รูปที่บังเอิญถ่ายทีหลัง */
  const order = (a: TimelineItem, b: TimelineItem) =>
    Number(b.pinned) - Number(a.pinned) || b.takenAt.localeCompare(a.takenAt);

  const slots: TimelineSlot[] = AGE_SLOTS.map((s) => {
    const list = (bySlot.get(s.id) ?? []).sort(order);
    return {
      id: s.id,
      label: s.label,
      kind: s.kind,
      startsOn: slotStart(birthDate, s),
      items: list,
      cover: list[0] ?? null,
    };
  });

  const over = (bySlot.get(OVER_SLOT_ID) ?? []).sort(order);
  if (over.length > 0) {
    slots.push({
      id: OVER_SLOT_ID,
      label: OVER_SLOT_LABEL,
      kind: "over",
      startsOn: null,
      items: over,
      cover: over[0],
    });
  }

  return {
    slots,
    filled: AGE_SLOTS.filter((s) => (bySlot.get(s.id)?.length ?? 0) > 0).length,
    total: AGE_SLOTS.length,
  };
}
