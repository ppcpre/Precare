"use server";

import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { z } from "zod";
import { pushSubscriptions } from "@/db/schema";
import { authAction, AppError } from "@/lib/safe-action";
import { sendPush } from "@/lib/push";

/**
 * เก็บที่อยู่สำหรับส่ง push ของเครื่องนี้
 *
 * เบราว์เซอร์เดิมที่กดอนุญาตซ้ำจะได้ endpoint เดิม จึงเขียนทับแถวเดิม
 * ไม่ใช่สร้างใหม่ทุกครั้ง ไม่งั้นจะยิง push ซ้ำหลายใบไปเครื่องเดียว
 */
export const savePushSubscription = authAction
  .metadata({ name: "savePushSubscription" })
  .inputSchema(
    z.object({
      endpoint: z.string().url().max(1000),
      p256dh: z.string().max(200).nullable().optional(),
      auth: z.string().max(200).nullable().optional(),
    }),
  )
  .action(async ({ parsedInput, ctx }) => {
    const existing = await ctx.db
      .select({ id: pushSubscriptions.id, userId: pushSubscriptions.userId })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.endpoint, parsedInput.endpoint))
      .get();

    if (existing) {
      // เครื่องเดียวกันแต่เปลี่ยนคนล็อกอิน — ย้ายเจ้าของ ไม่ใช่สร้างแถวซ้ำ
      await ctx.db
        .update(pushSubscriptions)
        .set({
          userId: ctx.user.id,
          p256dh: parsedInput.p256dh ?? null,
          auth: parsedInput.auth ?? null,
        })
        .where(eq(pushSubscriptions.id, existing.id));
      return { ok: true };
    }

    await ctx.db.insert(pushSubscriptions).values({
      id: crypto.randomUUID(),
      userId: ctx.user.id,
      endpoint: parsedInput.endpoint,
      p256dh: parsedInput.p256dh ?? null,
      auth: parsedInput.auth ?? null,
    });
    return { ok: true };
  });

export const removePushSubscription = authAction
  .metadata({ name: "removePushSubscription" })
  .inputSchema(z.object({ endpoint: z.string().url().max(1000) }))
  .action(async ({ parsedInput, ctx }) => {
    await ctx.db
      .delete(pushSubscriptions)
      .where(
        and(
          eq(pushSubscriptions.endpoint, parsedInput.endpoint),
          eq(pushSubscriptions.userId, ctx.user.id),
        ),
      );
    return { ok: true };
  });

/**
 * ส่งทดสอบไปทุกเครื่องของตัวเอง
 *
 * มีไว้เพื่อให้ผู้ใช้ **พิสูจน์ได้เองว่าการเตือนทำงานจริง** ก่อนจะไว้ใจมัน
 * เพราะ push พังได้เงียบๆ หลายจุด (ไม่ได้ติดตั้งลงจอโฮมบน iOS, ปิดสิทธิ์ในระบบ,
 * subscription ตายไปแล้ว) ซึ่งผู้ใช้จะไม่มีทางรู้จนกว่าจะพลาดนัดจริง
 */
export const sendTestPush = authAction
  .metadata({ name: "sendTestPush" })
  .inputSchema(z.object({}))
  .action(async ({ ctx }) => {
    const { env } = await getCloudflareContext({ async: true });
    const privateKey = env.VAPID_PRIVATE_KEY;
    const publicKey = env.VAPID_PUBLIC_KEY;
    if (!privateKey || !publicKey) {
      throw new AppError("ยังไม่ได้ตั้งค่ากุญแจสำหรับส่งการแจ้งเตือนบนเซิร์ฟเวอร์");
    }

    const rows = await ctx.db
      .select({ id: pushSubscriptions.id, endpoint: pushSubscriptions.endpoint })
      .from(pushSubscriptions)
      .where(eq(pushSubscriptions.userId, ctx.user.id));
    if (rows.length === 0) throw new AppError("ยังไม่ได้เปิดการแจ้งเตือนบนเครื่องนี้");

    let sent = 0;
    let gone = 0;
    for (const row of rows) {
      const res = await sendPush({
        endpoint: row.endpoint,
        publicKey,
        privateKey,
        subject: env.VAPID_SUBJECT ?? "mailto:support@example.com",
      });
      if (res.ok) {
        sent++;
        await ctx.db
          .update(pushSubscriptions)
          .set({ lastSuccessAt: new Date().toISOString() })
          // กรอง userId ซ้ำแม้เพิ่งเลือกมาด้วย userId — ทุก statement ที่เขียนต้องกันตัวเอง
          .where(and(eq(pushSubscriptions.id, row.id), eq(pushSubscriptions.userId, ctx.user.id)));
      } else if (res.gone) {
        // เครื่องนี้ถอนการติดตั้งหรือล้างข้อมูลไปแล้ว ลบทิ้งไม่งั้นยิงไปที่ตายตลอดไป
        gone++;
        await ctx.db
          .delete(pushSubscriptions)
          .where(and(eq(pushSubscriptions.id, row.id), eq(pushSubscriptions.userId, ctx.user.id)));
      }
    }

    if (sent === 0) {
      throw new AppError(
        gone > 0
          ? "การแจ้งเตือนบนเครื่องนี้หมดอายุแล้ว ลองปิดแล้วเปิดใหม่อีกครั้ง"
          : "ส่งการแจ้งเตือนไม่สำเร็จ ลองใหม่อีกครั้ง",
      );
    }
    return { sent };
  });
