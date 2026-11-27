/**
 * ฝั่งอ่านของยาและไข้ของลูก
 *
 * ⚠️ รับ familyId ที่ผ่าน requireFamilyContext มาแล้วเท่านั้น — childId มาจาก URL
 */
import { and, desc, eq, inArray } from "drizzle-orm";
import type { Db } from "@/db";
import { childMedDoses, childMeds, childTemps, user } from "@/db/schema";
import type { DoseView } from "@/lib/child-meds";
import type { TempSite } from "@/lib/child-temp";

export type ChildMedView = {
  id: string;
  name: string;
  dose: string | null;
  mode: "prn" | "daily";
  minGapMin: number | null;
  times: string | null;
  note: string | null;
  active: boolean;
  /** ใหม่สุดก่อน — พอสำหรับ "ให้ล่าสุด" กับรายการของวันนี้ */
  doses: DoseView[];
};

export async function listChildMeds(db: Db, familyId: string, childId: string): Promise<ChildMedView[]> {
  const meds = await db
    .select({
      id: childMeds.id,
      name: childMeds.name,
      dose: childMeds.dose,
      mode: childMeds.mode,
      minGapMin: childMeds.minGapMin,
      times: childMeds.times,
      note: childMeds.note,
      active: childMeds.active,
    })
    .from(childMeds)
    .where(and(eq(childMeds.familyId, familyId), eq(childMeds.childId, childId)))
    .orderBy(desc(childMeds.active), desc(childMeds.createdAt));
  if (meds.length === 0) return [];

  const doses = await db
    .select({
      id: childMedDoses.id,
      medId: childMedDoses.medId,
      givenAt: childMedDoses.givenAt,
      givenBy: childMedDoses.givenBy,
      givenByName: user.name,
    })
    .from(childMedDoses)
    .leftJoin(user, eq(user.id, childMedDoses.givenBy))
    .where(
      and(
        eq(childMedDoses.familyId, familyId),
        inArray(
          childMedDoses.medId,
          meds.map((m) => m.id),
        ),
      ),
    )
    .orderBy(desc(childMedDoses.givenAt))
    .limit(200);

  const by = new Map<string, DoseView[]>();
  for (const d of doses) {
    const arr = by.get(d.medId) ?? [];
    if (arr.length < 12) arr.push({ id: d.id, givenAt: d.givenAt, givenBy: d.givenBy, givenByName: d.givenByName });
    by.set(d.medId, arr);
  }
  return meds.map((m) => ({ ...m, doses: by.get(m.id) ?? [] }));
}

export type ChildTempView = {
  id: string;
  measuredAt: string;
  tempTenths: number;
  site: TempSite;
  symptoms: string[];
  createdBy: string;
  createdByName: string | null;
};

export async function listChildTemps(db: Db, familyId: string, childId: string, limit = 10): Promise<ChildTempView[]> {
  const rows = await db
    .select({
      id: childTemps.id,
      measuredAt: childTemps.measuredAt,
      tempTenths: childTemps.tempTenths,
      site: childTemps.site,
      symptoms: childTemps.symptoms,
      createdBy: childTemps.createdBy,
      createdByName: user.name,
    })
    .from(childTemps)
    .leftJoin(user, eq(user.id, childTemps.createdBy))
    .where(and(eq(childTemps.familyId, familyId), eq(childTemps.childId, childId)))
    .orderBy(desc(childTemps.measuredAt))
    .limit(limit);
  return rows.map((r) => {
    let symptoms: string[] = [];
    try {
      const v: unknown = r.symptoms ? JSON.parse(r.symptoms) : [];
      if (Array.isArray(v)) symptoms = v.filter((x): x is string => typeof x === "string");
    } catch {
      // แถวเสียไม่ควรทำให้ทั้งหน้าพัง
    }
    return { ...r, symptoms };
  });
}
