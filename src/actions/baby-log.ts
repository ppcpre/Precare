"use server";

import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Db } from "@/db";
import {
  BREAST_SIDES,
  DIAPER_KINDS,
  MILK_KINDS,
  babyLogs,
  children,
} from "@/db/schema";
import { AppError, editorAction } from "@/lib/safe-action";
import { localNowIso } from "@/lib/local-time";
import { secondsBetween } from "@/lib/baby-log";

/**
 * เวลามาจาก client เสมอ (worker รันใน UTC — ดู src/actions/kicks.ts)
 * แต่ต้องไม่ล้ำอนาคต เผื่อนาฬิกาเครื่องเหลื่อมไว้ 10 นาที
 */
const localTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/, "รูปแบบเวลาไม่ถูกต้อง")
  .refine((v) => v <= localNowIso(Date.now() + 10 * 60_000), "เวลาต้องไม่เป็นอนาคต")
  .refine((v) => v >= "2000-01-01T00:00:00", "เวลาไม่ถูกต้อง");

const id = z.string().min(1);
/** ปริมาณที่เป็นไปได้จริงต่อครั้ง — กันพิมพ์ศูนย์เกิน */
const ml = z.number().int().min(0).max(500);

async function assertChild(db: Db, familyId: string, childId: string) {
  const row = await db
    .select({ id: children.id })
    .from(children)
    .where(and(eq(children.id, childId), eq(children.familyId, familyId)))
    .get();
  if (!row) throw new AppError("ไม่พบข้อมูลลูกคนนี้");
  return row.id;
}

const revalidate = (childId: string | null) => {
  revalidatePath("/dashboard");
  if (childId) revalidatePath(`/baby/${childId}/log`);
};

/**
 * เริ่มจับเวลาเต้าหรือนอน
 *
 * หนึ่งรอบต่อประเภทต่อลูก — ถ้าอีกคนในบ้านเริ่มไว้แล้ว คืนรอบเดิม ไม่เริ่มซ้อน
 * (พ่อกดนอนแล้ว แม่เปิดมากดอีก ต้องเห็นรอบเดียวกัน ไม่ใช่สองรอบที่นับเรื่องเดียวกัน)
 */
export const startBabyTimer = editorAction
  .metadata({ name: "startBabyTimer" })
  .inputSchema(
    z.object({
      childId: id,
      kind: z.enum(["breast", "sleep"]),
      at: localTime,
      side: z.enum(BREAST_SIDES).optional(),
    }),
  )
  .action(async ({ parsedInput: p, ctx }) => {
    const childId = await assertChild(ctx.db, ctx.familyId, p.childId);
    const existing = await ctx.db
      .select({ id: babyLogs.id })
      .from(babyLogs)
      .where(
        and(
          eq(babyLogs.familyId, ctx.familyId),
          eq(babyLogs.childId, childId),
          eq(babyLogs.kind, p.kind),
          isNull(babyLogs.endedAt),
        ),
      )
      .get();
    if (existing) return { id: existing.id, resumed: true };

    const newId = crypto.randomUUID();
    const breast = p.kind === "breast";
    await ctx.db.insert(babyLogs).values({
      id: newId,
      familyId: ctx.familyId,
      childId,
      kind: p.kind,
      startedAt: p.at,
      endedAt: null,
      leftSec: breast ? 0 : null,
      rightSec: breast ? 0 : null,
      side: breast ? (p.side ?? "left") : null,
      sideStartedAt: breast ? p.at : null,
      createdBy: ctx.user.id,
    });
    revalidate(childId);
    return { id: newId, resumed: false };
  });

/**
 * แตะข้างของเต้า
 *
 * - แตะข้างที่กำลังจับอยู่ = พัก (ลูกหลับคาเต้า เรอ เปลี่ยนท่า)
 * - แตะอีกข้าง = เก็บเวลาข้างเดิมแล้วเริ่มข้างใหม่
 * - กำลังพักอยู่ แตะข้างไหน = เริ่มข้างนั้น
 *
 * อ่านแล้วเขียนกลับ แต่เขียนแบบมีเงื่อนไขว่า sideStartedAt ยังเป็นค่าเดิม
 * สองเครื่องแตะทับกัน เครื่องที่ช้ากว่าจะไม่เขียนทับเวลาที่อีกเครื่องเพิ่งเก็บ
 */
export const tapBreastSide = editorAction
  .metadata({ name: "tapBreastSide" })
  .inputSchema(z.object({ logId: id, side: z.enum(BREAST_SIDES), at: localTime }))
  .action(async ({ parsedInput: p, ctx }) => {
    const scope = and(
      eq(babyLogs.id, p.logId),
      eq(babyLogs.familyId, ctx.familyId),
      eq(babyLogs.kind, "breast"),
      isNull(babyLogs.endedAt),
    );
    const row = await ctx.db.select().from(babyLogs).where(scope).get();
    if (!row) throw new AppError("รอบนี้จบไปแล้ว");

    let left = row.leftSec ?? 0;
    let right = row.rightSec ?? 0;
    if (row.sideStartedAt && row.side) {
      const live = secondsBetween(row.sideStartedAt, p.at);
      if (row.side === "left") left += live;
      else right += live;
    }
    const pausing = row.sideStartedAt !== null && row.side === p.side;

    const res = await ctx.db
      .update(babyLogs)
      .set({
        leftSec: left,
        rightSec: right,
        side: p.side,
        sideStartedAt: pausing ? null : p.at,
      })
      .where(
        and(
          scope,
          eq(babyLogs.familyId, ctx.familyId),
          row.sideStartedAt === null
            ? isNull(babyLogs.sideStartedAt)
            : eq(babyLogs.sideStartedAt, row.sideStartedAt),
        ),
      );
    if (!res.meta.changes) throw new AppError("มีคนในบ้านเพิ่งแตะไปพร้อมกัน ลองอีกครั้ง");
    revalidate(row.childId);
    return { paused: pausing };
  });

/** หยุดและบันทึก — เต้าเก็บเวลาข้างสุดท้ายก่อนปิด */
export const stopBabyTimer = editorAction
  .metadata({ name: "stopBabyTimer" })
  .inputSchema(z.object({ logId: id, at: localTime }))
  .action(async ({ parsedInput: p, ctx }) => {
    const scope = and(
      eq(babyLogs.id, p.logId),
      eq(babyLogs.familyId, ctx.familyId),
      isNull(babyLogs.endedAt),
    );
    const row = await ctx.db.select().from(babyLogs).where(scope).get();
    if (!row) throw new AppError("รอบนี้จบไปแล้ว");

    const patch: Partial<typeof babyLogs.$inferInsert> = {
      endedAt: p.at < row.startedAt ? row.startedAt : p.at,
    };
    if (row.kind === "breast" && row.sideStartedAt && row.side) {
      const live = secondsBetween(row.sideStartedAt, p.at);
      if (row.side === "left") patch.leftSec = (row.leftSec ?? 0) + live;
      else patch.rightSec = (row.rightSec ?? 0) + live;
      patch.sideStartedAt = null;
    }
    const res = await ctx.db
      .update(babyLogs)
      .set(patch)
      .where(and(scope, eq(babyLogs.familyId, ctx.familyId)));
    if (!res.meta.changes) throw new AppError("รอบนี้จบไปแล้ว");
    revalidate(row.childId);
    return { ok: true };
  });

/**
 * แก้เวลาเริ่มของรอบนอนที่ยังนอนอยู่ — "ลืมกดตอนลูกหลับ"
 *
 * ทำได้เฉพาะนอน เต้ามีเวลาแยกข้างที่ต้องขยับตาม ซึ่งเดาแทนไม่ได้
 */
export const setSleepStart = editorAction
  .metadata({ name: "setSleepStart" })
  .inputSchema(z.object({ logId: id, at: localTime }))
  .action(async ({ parsedInput: p, ctx }) => {
    const res = await ctx.db
      .update(babyLogs)
      .set({ startedAt: p.at })
      .where(
        and(
          eq(babyLogs.id, p.logId),
          eq(babyLogs.familyId, ctx.familyId),
          eq(babyLogs.kind, "sleep"),
          isNull(babyLogs.endedAt),
        ),
      );
    if (!res.meta.changes) throw new AppError("รอบนี้จบไปแล้ว");
    revalidatePath("/dashboard");
    return { ok: true };
  });

/**
 * บันทึกของที่จบในครั้งเดียว และการใส่ย้อนหลังของเต้า/นอน
 *
 * ปั๊มนมไม่รับ childId โดยตั้งใจ — เป็นข้อมูลของแม่
 */
const addInput = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("bottle"),
    childId: id,
    at: localTime,
    ml: ml.min(1, "ใส่ปริมาณก่อน"),
    milk: z.enum(MILK_KINDS),
  }),
  z.object({ kind: z.literal("diaper"), childId: id, at: localTime, diaper: z.enum(DIAPER_KINDS) }),
  z.object({ kind: z.literal("bath"), childId: id, at: localTime }),
  z.object({
    kind: z.literal("pump"),
    at: localTime,
    leftMl: ml,
    rightMl: ml,
    minutes: z.number().int().min(1).max(120).nullable(),
  }),
  z.object({
    kind: z.literal("sleep"),
    childId: id,
    at: localTime,
    endAt: localTime,
  }),
  z.object({
    kind: z.literal("breast"),
    childId: id,
    at: localTime,
    leftMin: z.number().int().min(0).max(120),
    rightMin: z.number().int().min(0).max(120),
    lastSide: z.enum(BREAST_SIDES),
  }),
]);

export const addBabyLog = editorAction
  .metadata({ name: "addBabyLog" })
  .inputSchema(addInput)
  .action(async ({ parsedInput: p, ctx }) => {
    const childId = p.kind === "pump" ? null : await assertChild(ctx.db, ctx.familyId, p.childId);
    const base = {
      id: crypto.randomUUID(),
      familyId: ctx.familyId,
      childId,
      kind: p.kind,
      startedAt: p.at,
      endedAt: p.at,
      createdBy: ctx.user.id,
    };

    let row: typeof babyLogs.$inferInsert;
    switch (p.kind) {
      case "bottle":
        row = { ...base, ml: p.ml, milk: p.milk };
        break;
      case "diaper":
        row = { ...base, diaper: p.diaper };
        break;
      case "bath":
        row = base;
        break;
      case "pump": {
        if (p.leftMl + p.rightMl === 0) throw new AppError("ใส่ปริมาณอย่างน้อยหนึ่งข้าง");
        const end = p.minutes
          ? new Date(Date.parse(`${p.at}Z`) + p.minutes * 60_000).toISOString().slice(0, 19)
          : p.at;
        row = { ...base, endedAt: end, leftMl: p.leftMl, rightMl: p.rightMl };
        break;
      }
      case "sleep":
        if (p.endAt <= p.at) throw new AppError("เวลาตื่นต้องหลังเวลาเริ่มนอน");
        row = { ...base, endedAt: p.endAt };
        break;
      case "breast": {
        const sec = (p.leftMin + p.rightMin) * 60;
        if (!sec) throw new AppError("ใส่เวลาอย่างน้อยหนึ่งข้าง");
        row = {
          ...base,
          endedAt: new Date(Date.parse(`${p.at}Z`) + sec * 1000).toISOString().slice(0, 19),
          leftSec: p.leftMin * 60,
          rightSec: p.rightMin * 60,
          side: p.lastSide,
        };
        break;
      }
    }
    await ctx.db.insert(babyLogs).values(row);
    revalidate(childId);
    return { id: base.id };
  });

/**
 * ลบรายการ — ใช้ทั้งปุ่ม "เลิกทำ" หลังแตะผ้าอ้อม และการทิ้งรอบที่กดเริ่มผิด
 *
 * ลบจริง ไม่ซ่อน — รายการที่กดพลาดต้องไม่ไปนับในสรุปของวัน
 */
export const deleteBabyLog = editorAction
  .metadata({ name: "deleteBabyLog" })
  .inputSchema(z.object({ logId: id }))
  .action(async ({ parsedInput: p, ctx }) => {
    const row = await ctx.db
      .select({ childId: babyLogs.childId })
      .from(babyLogs)
      .where(and(eq(babyLogs.id, p.logId), eq(babyLogs.familyId, ctx.familyId)))
      .get();
    if (!row) throw new AppError("ไม่พบรายการนี้");
    await ctx.db
      .delete(babyLogs)
      .where(and(eq(babyLogs.id, p.logId), eq(babyLogs.familyId, ctx.familyId)));
    revalidate(row.childId);
    return { ok: true };
  });
