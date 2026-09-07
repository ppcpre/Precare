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
 * ผูกสิทธิ์กับเจ้าของไฟล์จริงผ่าน storage_objects
 * - ไฟล์ของตัวเอง (avatar) ดูได้เสมอ แม้จะย้ายครอบครัวไปแล้ว
 * - ไฟล์ของครอบครัว ต้องเป็นสมาชิก active ของครอบครัวนั้น
 *
 * ตอบ 404 ไม่ใช่ 403 ให้ตรงกับหลักใน src/lib/authz.ts — คนนอกไม่ควรรู้ด้วยซ้ำ
 * ว่าไฟล์นี้มีอยู่จริง
 */

/** ชนิดที่ยอมให้เสิร์ฟ — กันไฟล์แปลกปลอมที่หลุดเข้า bucket มาทำงานในเบราว์เซอร์ */
const SERVABLE = new Set(["image/webp", "image/jpeg", "image/png", "video/mp4", "video/quicktime"]);

/** นามสกุลของไฟล์วิดีโอที่เราตั้งเอง -> content-type ที่ต้องตอบกลับ */
const VIDEO_EXT: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime" };

/**
 * อ่านหัว Range แบบที่วิดีโอใช้จริง คือ `bytes=<start>-` และ `bytes=<start>-<end>`
 * รูปแบบอื่น (หลายช่วง, suffix range) คืน null แล้วให้ส่งทั้งไฟล์ไป
 * ซึ่งถูกต้องตามสเปกและง่ายกว่าการรองรับให้ครบโดยไม่มีใครใช้
 */
function parseRange(header: string | null, size: number) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(header?.trim() ?? "");
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Number(m[2]);
  if (start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

export async function GET(req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const key = (await params).key.join("/");
  const db = await getDb();

  // รวมเป็น query เดียว — เส้นทางนี้ถูกยิงทุกรูปในอัลบั้มพร้อมกัน
  // การยิง D1 สองรอบต่อรูปทำให้หน้าที่มีรูปเยอะกินโควตาและ latency เกินจำเป็น
  // leftJoin เพราะไฟล์ของตัวเองต้องดูได้แม้ไม่ได้เป็นสมาชิกครอบครัวนั้นแล้ว
  const row = await db
    .select({
      uploadedBy: storageObjects.uploadedBy,
      familyId: storageObjects.familyId,
      role: familyMembers.role,
    })
    .from(storageObjects)
    .leftJoin(
      familyMembers,
      and(
        eq(familyMembers.familyId, storageObjects.familyId),
        eq(familyMembers.userId, user.id),
        eq(familyMembers.status, "active"),
      ),
    )
    .where(eq(storageObjects.key, key))
    .get();

  if (!row) return new Response(null, { status: 404 });
  if (row.uploadedBy !== user.id && !row.role) return new Response(null, { status: 404 });

  const { env } = await getCloudflareContext({ async: true });

  const common = {
    // ห้ามเป็น public — CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
    "cache-control": "private, max-age=3600",
    // ต่อให้ content-type หลุดมาผิด ก็ยังไม่ถูกเปิดเป็นหน้าเว็บ
    "content-disposition": "inline",
    "x-content-type-options": "nosniff",
  };

  /**
   * แยกทางด้วยนามสกุลของ key ไม่ใช่ด้วย content-type จาก R2
   *
   * เพราะ key เป็นของเราเอง (`.../videos/<uuid>.mp4` หรือ `.mov`) จึงเชื่อได้โดยไม่ต้อง
   * ถาม R2 ก่อน — เดิมยิง head() นำทุกครั้งเพื่อดู content-type ซึ่งทำให้
   * รูปทุกใบในอัลบั้มกิน R2 สองครั้งต่อใบ ทั้งที่ 99% ของคำขอเป็นรูป
   */
  const videoType = VIDEO_EXT[key.slice(key.lastIndexOf(".") + 1)];
  if (!videoType) {
    const obj = await env.PHOTOS_BUCKET.get(key);
    // แถวยังอยู่แต่ไฟล์หาย = ข้อมูลไม่ตรงกัน ไม่ใช่เรื่องปกติ
    if (!obj) return new Response(null, { status: 404 });

    const declared = obj.httpMetadata?.contentType ?? "";
    /**
     * อ่านทั้งก้อนแทนการส่ง obj.body เป็นสตรีม
     *
     * ไฟล์ถูกจำกัดไว้ที่ 5 MB ตั้งแต่ตอนอัปโหลด และรูปที่ย่อแล้วอยู่ราว 200–400 KB
     * การบัฟเฟอร์จึงแทบไม่กินหน่วยความจำ แต่ตัดปัญหาเรื่องอายุของสตรีมทิ้งทั้งหมด
     * (เบราว์เซอร์ยกเลิกโหลดรูปกลางคันได้ตลอด เช่นตอนเปลี่ยนหน้า)
     */
    return new Response(await obj.arrayBuffer(), {
      headers: {
        ...common,
        "content-type": SERVABLE.has(declared) ? declared : "application/octet-stream",
      },
    });
  }

  /**
   * วิดีโอเดินคนละทางกับรูป
   *
   * เบราว์เซอร์ขอวิดีโอเป็นช่วงๆ ด้วยหัว Range เสมอ ถ้าตอบทั้งไฟล์กลับไป
   * ทุกครั้ง การเลื่อนแถบเวลาจะเท่ากับโหลดใหม่ทั้งคลิป และ Safari จะไม่ยอม
   * เริ่มเล่นเลยถ้าไม่เห็น 206 กับ accept-ranges
   *
   * และห้ามบัฟเฟอร์ทั้งก้อนเหมือนรูป — คลิป 40 MB ในหน่วยความจำของ worker
   * ที่มีเพดาน 128 MB คือการเสี่ยงโดยไม่ได้อะไรกลับมา
   */
  const head = await env.PHOTOS_BUCKET.head(key);
  if (!head) return new Response(null, { status: 404 });

  const range = parseRange(req.headers.get("range"), head.size);
  const obj = range
    ? await env.PHOTOS_BUCKET.get(key, {
        range: { offset: range.start, length: range.end - range.start + 1 },
      })
    : await env.PHOTOS_BUCKET.get(key);
  if (!obj?.body) return new Response(null, { status: 404 });

  return new Response(obj.body, {
    status: range ? 206 : 200,
    headers: {
      ...common,
      "content-type": videoType,
      "accept-ranges": "bytes",
      ...(range
        ? {
            "content-range": `bytes ${range.start}-${range.end}/${head.size}`,
            "content-length": String(range.end - range.start + 1),
          }
        : { "content-length": String(head.size) }),
    },
  });
}

