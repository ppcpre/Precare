/**
 * ฝั่งอ่านของบันทึกประจำวันลูก
 *
 * ⚠️ รับ familyId ที่ผ่าน requireFamilyContext มาแล้วเท่านั้น
 *    childId มาจาก URL — ทุก query กรองคู่กับ familyId เสมอ
 */
import { and, desc, eq, gte, inArray, isNull, lt, or } from "drizzle-orm";
import type { Db } from "@/db";
import { BABY_LOG_KINDS, babyLogs, user, type BabyLogKind } from "@/db/schema";
import { addSeconds, type BabyLogView } from "@/lib/baby-log";

const cols = {
  id: babyLogs.id,
  childId: babyLogs.childId,
  kind: babyLogs.kind,
  startedAt: babyLogs.startedAt,
  endedAt: babyLogs.endedAt,
  leftSec: babyLogs.leftSec,
  rightSec: babyLogs.rightSec,
  side: babyLogs.side,
  sideStartedAt: babyLogs.sideStartedAt,
  ml: babyLogs.ml,
  milk: babyLogs.milk,
  leftMl: babyLogs.leftMl,
  rightMl: babyLogs.rightMl,
  diaper: babyLogs.diaper,
  note: babyLogs.note,
  createdBy: babyLogs.createdBy,
  createdByName: user.name,
};

/** ของลูกคนนี้ + ปั๊มนมของบ้าน (ไม่ผูกลูก) */
const ofChild = (childId: string) =>
  or(eq(babyLogs.childId, childId), and(isNull(babyLogs.childId), eq(babyLogs.kind, "pump")));

/**
 * รายการที่ทับช่วง [from, to) — นอนที่เริ่มเมื่อวานแล้วตื่นวันนี้ก็ติดมาด้วย
 */
export async function listBabyLogs(
  db: Db,
  familyId: string,
  childId: string,
  from: string,
  to: string,
): Promise<BabyLogView[]> {
  return db
    .select(cols)
    .from(babyLogs)
    .leftJoin(user, eq(user.id, babyLogs.createdBy))
    .where(
      and(
        eq(babyLogs.familyId, familyId),
        ofChild(childId),
        lt(babyLogs.startedAt, to),
        // รอบที่ยังจับอยู่ (endedAt = null) ทับทุกช่วงหลังจากที่เริ่ม
        or(isNull(babyLogs.endedAt), gte(babyLogs.endedAt, from)),
        // กันนอนค้างข้ามหลายวันดึงทั้งประวัติ — ไม่มีรายการไหนยาวเกินสองวันจริง
        gte(babyLogs.startedAt, addSeconds(from, -2 * 86_400)),
      ),
    )
    .orderBy(desc(babyLogs.startedAt));
}

/**
 * ครั้งล่าสุดของแต่ละประเภท + รอบที่จับเวลาค้างอยู่
 *
 * แยก query ต่อประเภทเพราะอาบน้ำครั้งล่าสุดอาจเป็นเมื่อสามวันก่อน
 * ดึงช่วงเวลาคงที่แล้วหาเองจะพลาด — แต่ละตัวใช้ index เดียวกัน limit 1 ถูกมาก
 */
export async function latestBabyLogs(
  db: Db,
  familyId: string,
  childId: string,
): Promise<{ latest: Partial<Record<BabyLogKind, BabyLogView>>; open: BabyLogView[] }> {
  const one = (kind: BabyLogKind) =>
    db
      .select(cols)
      .from(babyLogs)
      .leftJoin(user, eq(user.id, babyLogs.createdBy))
      .where(
        and(
          eq(babyLogs.familyId, familyId),
          eq(babyLogs.kind, kind),
          kind === "pump" ? isNull(babyLogs.childId) : eq(babyLogs.childId, childId),
        ),
      )
      .orderBy(desc(babyLogs.startedAt))
      .limit(1);

  const [open, ...rows] = await Promise.all([
    db
      .select(cols)
      .from(babyLogs)
      .leftJoin(user, eq(user.id, babyLogs.createdBy))
      .where(
        and(
          eq(babyLogs.familyId, familyId),
          eq(babyLogs.childId, childId),
          isNull(babyLogs.endedAt),
          inArray(babyLogs.kind, ["breast", "sleep"]),
        ),
      ),
    ...BABY_LOG_KINDS.map(one),
  ]);

  const latest: Partial<Record<BabyLogKind, BabyLogView>> = {};
  BABY_LOG_KINDS.forEach((k, i) => {
    const r = rows[i][0];
    if (r) latest[k] = r;
  });
  // รอบที่ค้างอยู่ชนะเสมอ — การ์ดต้องขึ้น "กำลังนอน" แม้มีคนใส่ย้อนหลังที่ใหม่กว่า
  for (const o of open) latest[o.kind] = o;
  return { latest, open };
}

/** ปั๊มครั้งล่าสุดของบ้าน — ใช้ตั้งค่าเริ่มของฟอร์ม (คนปั๊มมักได้ปริมาณใกล้เดิม) */
export async function lastPump(db: Db, familyId: string) {
  const [row] = await db
    .select({ leftMl: babyLogs.leftMl, rightMl: babyLogs.rightMl })
    .from(babyLogs)
    .where(and(eq(babyLogs.familyId, familyId), eq(babyLogs.kind, "pump"), isNull(babyLogs.childId)))
    .orderBy(desc(babyLogs.startedAt))
    .limit(1);
  return row ?? null;
}
