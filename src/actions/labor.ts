"use server";

import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { trackingSessions } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import type { Db } from "@/db";
import { STALE_HOURS, parseContractions } from "@/lib/labor";

/** กันข้อมูลบวมจากการแตะรัว — รอบจริงยาวสุดไม่กี่ชั่วโมงก็ไม่ถึงนี้ */
const MAX_EVENTS = 300;

/**
 * เวลาต้องมาจาก client เสมอ — worker รันในโซน UTC
 * ถ้าสร้างเวลาฝั่งเซิร์ฟเวอร์ ตัวจับเวลาจะเพี้ยนไปตามผลต่างของโซนเวลา
 * (บทเรียนจากนับลูกดิ้น ซึ่งเคยขึ้น 7:00:10 ทันทีที่กดเริ่ม)
 */
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง");
const idInput = z.object({ sessionId: z.string().min(1) });

const openSession = (familyId: string) =>
  and(
    eq(trackingSessions.familyId, familyId),
    eq(trackingSessions.kind, "contraction"),
    isNull(trackingSessions.endedAt),
  );

export const startLaborSession = editorAction
  .metadata({ name: "startLaborSession" })
  .inputSchema(z.object({ at: localTime }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db
      .select({ id: trackingSessions.id, startedAt: trackingSessions.startedAt })
      .from(trackingSessions)
      .where(openSession(ctx.familyId))
      .orderBy(desc(trackingSessions.startedAt))
      .get();

    // มีรอบค้างที่ยังไม่เก่า = คนในบ้านอีกคนเพิ่งเริ่มไว้ ใช้รอบเดิมต่อ
    // ตอนเจ็บท้องมีหลายคนหยิบมือถือช่วยจับ สองรอบแยกกันจะทำให้เกณฑ์เพี้ยนทั้งคู่
    if (existing) {
      const fresh = new Date(existing.startedAt).getTime() >= Date.now() - STALE_HOURS * 3600_000;
      if (fresh) return { id: existing.id, resumed: true };
      await closeStale(ctx.db, ctx.familyId, existing.id);
    }

    const id = crypto.randomUUID();
    await ctx.db.insert(trackingSessions).values({
      id,
      familyId: ctx.familyId,
      createdBy: ctx.user.id,
      kind: "contraction",
      startedAt: parsedInput.at,
      events: "[]",
    });
    revalidatePath("/labor");
    revalidatePath("/dashboard");
    return { id, resumed: false };
  });

/**
 * เริ่มบีบ — ต่อท้าย events ด้วย statement เดียว
 *
 * ห้ามอ่านมาแก้แล้วเขียนกลับ สองคำขอที่ทับกันจะเขียนทับกันแล้วครั้งที่แตะหายเงียบๆ
 * (บทเรียนจากนับลูกดิ้น ซึ่ง CI จับได้เพราะเครื่องช้ากว่าเครื่องพัฒนา)
 *
 * เงื่อนไข `json_extract(..., '$[#-1].to') IS NOT NULL` กันการกดเริ่มซ้อน
 * ตอนที่ยังบีบอยู่ — ซึ่งเกิดได้ง่ายมากเพราะปุ่มเดียวทำสองหน้าที่
 */
export const beginContraction = editorAction
  .metadata({ name: "beginContraction" })
  .inputSchema(idInput.extend({ at: localTime }))
  .action(async ({ parsedInput, ctx }) => {
    const scope = and(
      eq(trackingSessions.id, parsedInput.sessionId),
      openSession(ctx.familyId),
    );

    const res = await ctx.db
      .update(trackingSessions)
      .set({
        events: sql`json_insert(${trackingSessions.events}, '$[#]', json_object('at', ${parsedInput.at}, 'to', null))`,
      })
      .where(
        and(
          scope,
          sql`json_array_length(${trackingSessions.events}) < ${MAX_EVENTS}`,
          sql`(json_array_length(${trackingSessions.events}) = 0
               OR json_extract(${trackingSessions.events}, '$[#-1].to') IS NOT NULL)`,
        ),
      );

    if (!res.meta.changes) throw await explain(ctx.db, ctx.familyId, parsedInput.sessionId);

    revalidatePath("/labor");
    return { ok: true };
  });

/** คลายแล้ว — เติมเวลาจบให้ครั้งล่าสุด */
export const endContraction = editorAction
  .metadata({ name: "endContraction" })
  .inputSchema(idInput.extend({ at: localTime }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .update(trackingSessions)
      .set({
        events: sql`json_set(${trackingSessions.events}, '$[#-1].to', ${parsedInput.at})`,
      })
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          openSession(ctx.familyId),
          // ต้องมีครั้งที่กำลังบีบอยู่จริง ไม่งั้นจะไปทับเวลาจบของครั้งก่อน
          sql`json_extract(${trackingSessions.events}, '$[#-1].to') IS NULL`,
        ),
      );

    if (!res.meta.changes) throw await explain(ctx.db, ctx.familyId, parsedInput.sessionId);

    revalidatePath("/labor");
    return { ok: true };
  });

export const closeLaborSession = editorAction
  .metadata({ name: "closeLaborSession" })
  .inputSchema(idInput.extend({ at: localTime }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .update(trackingSessions)
      .set({ endedAt: parsedInput.at })
      .where(and(eq(trackingSessions.id, parsedInput.sessionId), openSession(ctx.familyId)));
    if (!res.meta.changes) throw new AppError("ไม่พบรอบที่กำลังจับเวลาอยู่");

    revalidatePath("/labor");
    revalidatePath("/dashboard");
    return { ok: true };
  });

/**
 * บอกสาเหตุที่เขียนไม่สำเร็จให้ตรง ไม่ใช่ error กลางๆ
 * ตอนเจ็บท้องไม่มีใครอยากเดาว่าทำไมปุ่มไม่ทำงาน
 */
async function explain(db: Db, familyId: string, sessionId: string): Promise<AppError> {
  const row = await db
    .select({ endedAt: trackingSessions.endedAt, events: trackingSessions.events })
    .from(trackingSessions)
    .where(and(eq(trackingSessions.id, sessionId), eq(trackingSessions.familyId, familyId)))
    .get();
  if (!row) return new AppError("ไม่พบรอบการจับเวลานี้");
  if (row.endedAt) return new AppError("รอบนี้ปิดไปแล้ว");
  const list = parseContractions(row.events);
  if (list.length >= MAX_EVENTS) return new AppError("บันทึกครบจำนวนสูงสุดแล้ว");
  return new AppError("จังหวะไม่ตรงกัน ลองโหลดหน้าใหม่อีกครั้ง");
}

/**
 * ปิดรอบที่ลืมทิ้งไว้ ใช้เวลาของเหตุการณ์สุดท้ายเป็นเวลาจบ
 * ไม่ใช้เวลาปัจจุบัน ไม่งั้นประวัติจะขึ้นว่าจับนาน 10 ชั่วโมง ซึ่งไม่จริง
 *
 * กรอง familyId ทุก statement แม้ id จะผ่านการตรวจมาแล้ว
 */
async function closeStale(db: Db, familyId: string, id: string) {
  const scope = and(eq(trackingSessions.id, id), eq(trackingSessions.familyId, familyId));
  const row = await db
    .select({ events: trackingSessions.events, startedAt: trackingSessions.startedAt })
    .from(trackingSessions)
    .where(scope)
    .get();
  if (!row) return;
  const list = parseContractions(row.events);
  const last = list.at(-1);
  await db
    .update(trackingSessions)
    .set({ endedAt: last?.to ?? last?.at ?? row.startedAt })
    .where(scope);
}
