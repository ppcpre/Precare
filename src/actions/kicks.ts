"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { trackingSessions } from "@/db/schema";
import { editorAction, AppError } from "@/lib/safe-action";
import type { Db } from "@/db";
import { STALE_HOURS, TARGET_COUNT, parseEvents } from "@/lib/kicks";

/** กันข้อมูลบวมจากการแตะรัวโดยไม่ตั้งใจ — รอบจริงไม่มีทางเกินนี้ */
const MAX_EVENTS = 200;

/**
 * เวลาต้องมาจาก client เสมอ
 * worker รันในโซน UTC การสร้างเวลาฝั่งเซิร์ฟเวอร์จะได้เวลาที่ไม่ตรงกับนาฬิกา
 * ที่ผู้ใช้เห็น แล้วตัวจับเวลาจะเพี้ยนไปตามผลต่างของโซนเวลา
 */
const localTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง");

export const startKickSession = editorAction
  .metadata({ name: "startKickSession" })
  .inputSchema(z.object({ at: localTime }))
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db
      .select({ id: trackingSessions.id, startedAt: trackingSessions.startedAt })
      .from(trackingSessions)
      .where(
        and(
          eq(trackingSessions.familyId, ctx.familyId),
          eq(trackingSessions.kind, "kick"),
          isNull(trackingSessions.endedAt),
        ),
      )
      .orderBy(desc(trackingSessions.startedAt))
      .get();

    // มีรอบค้างที่ยังไม่เก่า = คนในบ้านอีกคนเพิ่งเริ่มไว้ ให้ใช้รอบเดิมต่อ
    // ไม่งั้นจะได้สองรอบที่นับเรื่องเดียวกันแยกกัน
    if (existing) {
      const fresh = new Date(existing.startedAt).getTime() >= Date.now() - STALE_HOURS * 3600_000;
      if (fresh) return { id: existing.id, resumed: true };
      // รอบเก่าที่ลืมปิด ปิดให้ก่อนเริ่มรอบใหม่
      await closeStale(ctx.db, ctx.familyId, existing.id);
    }

    const id = crypto.randomUUID();
    await ctx.db.insert(trackingSessions).values({
      id,
      familyId: ctx.familyId,
      createdBy: ctx.user.id,
      kind: "kick",
      startedAt: parsedInput.at,
      targetCount: TARGET_COUNT,
      events: "[]",
    });
    revalidatePath("/kicks");
    revalidatePath("/dashboard");
    return { id, resumed: false };
  });

/**
 * ปิดรอบที่ลืมทิ้งไว้ ใช้เวลาแตะครั้งสุดท้ายเป็นเวลาจบ
 * ไม่ใช้เวลาปัจจุบัน ไม่งั้นประวัติจะขึ้นว่าใช้เวลา 14 ชั่วโมง ซึ่งไม่จริง
 *
 * กรอง familyId ทุก statement แม้ id จะผ่านการตรวจมาแล้ว
 * ฟังก์ชันนี้อาจถูกเรียกจากที่อื่นในอนาคตโดยไม่ได้ตรวจมาก่อน
 */
async function closeStale(db: Db, familyId: string, id: string) {
  const scope = and(eq(trackingSessions.id, id), eq(trackingSessions.familyId, familyId));
  const row = await db
    .select({ events: trackingSessions.events, startedAt: trackingSessions.startedAt })
    .from(trackingSessions)
    .where(scope)
    .get();
  if (!row) return;
  const events = parseEvents(row.events);
  const endedAt = events.length ? events[events.length - 1].at : row.startedAt;
  await db.update(trackingSessions).set({ endedAt }).where(scope);
}

const idInput = z.object({ sessionId: z.string().min(1) });

/**
 * บันทึกการดิ้นหนึ่งครั้ง
 *
 * เขียนทันทีทุกครั้งที่แตะ ไม่รวบไว้ส่งทีเดียวตอนจบ
 * เพราะรอบหนึ่งกินเวลาถึง 2 ชั่วโมง ระหว่างนั้นแอปอาจถูกปิดเมื่อไหร่ก็ได้
 * รอบหนึ่งมีราว 10 ครั้ง ต้นทุนการเขียนจึงไม่ใช่ประเด็น
 */
export const recordKick = editorAction
  .metadata({ name: "recordKick" })
  .inputSchema(idInput.extend({ at: localTime }))
  .action(async ({ parsedInput, ctx }) => {
    const row = await ctx.db
      .select({ events: trackingSessions.events, endedAt: trackingSessions.endedAt })
      .from(trackingSessions)
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          eq(trackingSessions.familyId, ctx.familyId),
        ),
      )
      .get();
    if (!row) throw new AppError("ไม่พบรอบการนับนี้");
    if (row.endedAt) throw new AppError("รอบนี้ปิดไปแล้ว");

    const events = parseEvents(row.events);
    if (events.length >= MAX_EVENTS) throw new AppError("บันทึกครบจำนวนสูงสุดแล้ว");

    // ใช้เวลาที่ client ส่งมา เพราะเป็นเวลาที่แม่รู้สึกจริง
    // ไม่ใช่เวลาที่ request วิ่งถึงเซิร์ฟเวอร์ ซึ่งช้ากว่าตามสัญญาณเน็ต
    events.push({ at: parsedInput.at });

    await ctx.db
      .update(trackingSessions)
      .set({ events: JSON.stringify(events) })
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          eq(trackingSessions.familyId, ctx.familyId),
        ),
      );
    revalidatePath("/kicks");
    return { count: events.length };
  });

/** ลบครั้งล่าสุด — แตะพลาดได้ตลอด โดยเฉพาะตอนง่วง */
export const undoKick = editorAction
  .metadata({ name: "undoKick" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    const row = await ctx.db
      .select({ events: trackingSessions.events, endedAt: trackingSessions.endedAt })
      .from(trackingSessions)
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          eq(trackingSessions.familyId, ctx.familyId),
        ),
      )
      .get();
    if (!row) throw new AppError("ไม่พบรอบการนับนี้");
    if (row.endedAt) throw new AppError("รอบนี้ปิดไปแล้ว");

    const events = parseEvents(row.events);
    events.pop();
    await ctx.db
      .update(trackingSessions)
      .set({ events: JSON.stringify(events) })
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          eq(trackingSessions.familyId, ctx.familyId),
        ),
      );
    revalidatePath("/kicks");
    return { count: events.length };
  });

export const finishKickSession = editorAction
  .metadata({ name: "finishKickSession" })
  .inputSchema(idInput.extend({ at: localTime, note: z.string().max(500).nullable().optional() }))
  .action(async ({ parsedInput, ctx }) => {
    const res = await ctx.db
      .update(trackingSessions)
      .set({ endedAt: parsedInput.at, note: parsedInput.note?.trim() || null })
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          eq(trackingSessions.familyId, ctx.familyId),
          isNull(trackingSessions.endedAt),
        ),
      );
    if (!res.meta.changes) throw new AppError("ไม่พบรอบที่กำลังนับอยู่");
    revalidatePath("/kicks");
    revalidatePath("/dashboard");
    return { ok: true };
  });

/** ทิ้งรอบที่เพิ่งเริ่มแล้วเปลี่ยนใจ — ไม่เก็บเข้าประวัติเพราะไม่มีข้อมูลอะไร */
export const discardKickSession = editorAction
  .metadata({ name: "discardKickSession" })
  .inputSchema(idInput)
  .action(async ({ parsedInput, ctx }) => {
    await ctx.db
      .delete(trackingSessions)
      .where(
        and(
          eq(trackingSessions.id, parsedInput.sessionId),
          eq(trackingSessions.familyId, ctx.familyId),
          isNull(trackingSessions.endedAt),
        ),
      );
    revalidatePath("/kicks");
    revalidatePath("/dashboard");
    return { ok: true };
  });
