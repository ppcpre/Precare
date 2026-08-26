import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { familyMembers, storageObjects } from "@/db/schema";
import { getSessionUser } from "@/lib/session";

/**
 * เสิร์ฟไฟล์จาก bucket private
 *
 * T6.5 — เดิมเช็คแค่ว่า "ล็อกอินอยู่ไหม" ซึ่งไม่พอ
 * key เป็นรูปแบบเดาได้ (family/<id>/photos/<uuid>.webp) ใครก็ตามที่มีบัญชี
 * จึงเปิดรูปของครอบครัวอื่นได้ถ้ารู้ key และคนที่ถูกถอดออกจากครอบครัวแล้ว
 * ก็ยังเปิดรูปเก่าได้ตราบใดที่ session ยังไม่หมดอายุ
 *
 * ตอนนี้ผูกสิทธิ์กับเจ้าของไฟล์จริงผ่าน storage_objects:
 * - ไฟล์ของตัวเอง (avatar) ดูได้เสมอ แม้จะย้ายครอบครัวไปแล้ว
 * - ไฟล์ของครอบครัว ต้องเป็นสมาชิก active ของครอบครัวนั้น
 *
 * ตอบ 404 ไม่ใช่ 403 ให้ตรงกับหลักใน src/lib/authz.ts — คนนอกไม่ควรรู้ด้วยซ้ำ
 * ว่าไฟล์นี้มีอยู่จริง
 */

/** ชนิดที่ยอมให้เสิร์ฟ — กันไฟล์แปลกปลอมที่หลุดเข้า bucket มาทำงานในเบราว์เซอร์ */
const SERVABLE = new Set(["image/webp", "image/jpeg", "image/png"]);

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const key = (await params).key.join("/");
  const db = await getDb();

  const row = await db
    .select({ familyId: storageObjects.familyId, uploadedBy: storageObjects.uploadedBy })
    .from(storageObjects)
    .where(eq(storageObjects.key, key))
    .get();
  if (!row) return new Response(null, { status: 404 });

  const isOwnFile = row.uploadedBy === user.id;
  if (!isOwnFile) {
    if (!row.familyId) return new Response(null, { status: 404 });
    const member = await db
      .select({ role: familyMembers.role })
      .from(familyMembers)
      .where(
        and(
          eq(familyMembers.familyId, row.familyId),
          eq(familyMembers.userId, user.id),
          eq(familyMembers.status, "active"),
        ),
      )
      .get();
    if (!member) return new Response(null, { status: 404 });
  }

  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.PHOTOS_BUCKET.get(key);
  // แถวยังอยู่แต่ไฟล์หาย = ข้อมูลไม่ตรงกัน ไม่ใช่เรื่องปกติ
  if (!obj) return new Response(null, { status: 404 });

  const declared = obj.httpMetadata?.contentType ?? "";
  const contentType = SERVABLE.has(declared) ? declared : "application/octet-stream";

  return new Response(obj.body, {
    headers: {
      "content-type": contentType,
      // ห้ามเป็น public — CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
      "cache-control": "private, max-age=3600",
      "content-length": String(obj.size),
      // ต่อให้ content-type หลุดมาผิด ก็ยังไม่ถูกเปิดเป็นหน้าเว็บ
      "content-disposition": "inline",
      "x-content-type-options": "nosniff",
    },
  });
}
