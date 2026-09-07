import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { familyMembers, user as userTable } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import {
  MAX_VIDEO_BYTES,
  StorageQuotaError,
  assertRoomFor,
  formatBytes,
  recordObject,
} from "@/lib/storage";

/**
 * รับไฟล์วิดีโอโดยสตรีมเข้า R2 ตรงๆ
 *
 * ทำไมไม่ใช้ Server Action เหมือนรูป: Server Action อ่าน body ทั้งก้อน
 * เข้าหน่วยความจำก่อนถึงจะเรียกโค้ดเราได้ คลิป 40 MB บวก overhead ของ
 * multipart กินหน่วยความจำของ worker (เพดาน 128 MB) โดยไม่จำเป็น
 * สตรีมเข้า R2 ใช้หน่วยความจำคงที่ไม่ว่าไฟล์จะใหญ่แค่ไหน
 *
 * ทำไมไม่ส่ง metadata มาด้วยกัน: วันที่ ประเภท และคำบรรยาย เป็นข้อมูลสุขภาพ
 * ถ้าใส่มาใน query string มันจะไปโผล่ใน access log ของ Cloudflare
 * (`GET /album 200 OK` ที่เห็นใน log ของ wrangler คือบรรทัดเดียวกันนั้น)
 * เส้นทางนี้จึงรับแต่ "ไบต์" ส่วน metadata ไปกับ action addVideo ในขาที่สอง
 *
 * ⚠️ เส้นทางนี้ไม่ได้ผ่าน safe-action chain จึงไม่ถูก scripts/check-authz.mjs
 *    ตรวจให้ การตรวจสิทธิ์ตรงนี้เขียนมือ และมีเทสต์ใน e2e/media-access.spec.ts คุมไว้
 */
export async function POST(req: Request) {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return json(401, "ยังไม่ได้เข้าสู่ระบบ");

  const db = await getDb();
  // อ่าน familyId จาก session เสมอ ห้ามรับจาก client — หลักเดียวกับ safe-action
  const row = await db
    .select({ familyId: userTable.activeFamilyId, role: familyMembers.role })
    .from(userTable)
    .leftJoin(
      familyMembers,
      and(
        eq(familyMembers.familyId, userTable.activeFamilyId),
        eq(familyMembers.userId, userTable.id),
        eq(familyMembers.status, "active"),
      ),
    )
    .where(eq(userTable.id, sessionUser.id))
    .get();

  const familyId = row?.familyId;
  if (!familyId) return json(403, "ยังไม่ได้เลือกครอบครัว");
  // viewer ดูได้อย่างเดียว — ต้องกันตรงนี้ด้วย ไม่ใช่กันแค่ที่ปุ่มบนหน้าจอ
  if (row.role !== "owner" && row.role !== "editor") {
    return json(403, "คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้");
  }

  const type = (req.headers.get("content-type") ?? "").split(";")[0].trim();
  // นามสกุลบน key ต้องตรงกับชนิดจริง เพราะเส้นทางเสิร์ฟไฟล์ใช้นามสกุลตัดสิน
  // ว่าจะตอบแบบวิดีโอ (Range/206) หรือแบบรูป (อ่านทั้งก้อน)
  const ext = type === "video/mp4" ? "mp4" : type === "video/quicktime" ? "mov" : null;
  if (!ext) return json(415, "รองรับเฉพาะไฟล์ mp4 และ mov");

  // ต้องรู้ขนาดก่อนเริ่มเขียน ไม่งั้นจะกันโควตาไม่ได้จนกว่าจะเขียนเสร็จ
  const declared = Number(req.headers.get("content-length") ?? 0);
  if (!declared || Number.isNaN(declared)) return json(411, "ไม่รู้ขนาดไฟล์");
  if (declared > MAX_VIDEO_BYTES) {
    return json(413, `คลิปใหญ่เกิน ${formatBytes(MAX_VIDEO_BYTES)}`);
  }
  if (!req.body) return json(400, "ไม่มีข้อมูลไฟล์");

  try {
    await assertRoomFor(db, declared, "video");
  } catch (e) {
    if (e instanceof StorageQuotaError) return json(507, e.message);
    throw e;
  }

  const { env } = await getCloudflareContext({ async: true });
  const key = `family/${familyId}/videos/${crypto.randomUUID()}.${ext}`;

  /**
   * ต้องผ่าน FixedLengthStream ไม่ใช่ส่ง req.body ให้ R2 ตรงๆ
   *
   * R2 รับสตรีมได้เฉพาะสตรีมที่รู้ความยาวแน่นอน แต่ body ที่มาถึง route
   * ผ่าน OpenNext แล้วไม่มีความยาวติดมา ("Provided readable stream must have
   * a known length") — เจอตอนเทสต์ ไม่ใช่ตอนอ่านเอกสาร
   *
   * ผลพลอยได้ที่สำคัญกว่า: ถ้าไบต์จริงไม่ตรงกับ content-length ที่แจ้งมา
   * สตรีมจะพังเอง การเขียนจึงล้มทันที ไม่ใช่แจ้ง 10 MB แล้วยัด 400 MB
   * เข้ามาหลังผ่านด่านโควตาไปแล้ว
   */
  const fixed = new FixedLengthStream(declared);
  const pumping = req.body.pipeTo(fixed.writable);

  let object;
  try {
    [object] = await Promise.all([
      env.PHOTOS_BUCKET.put(key, fixed.readable, {
        httpMetadata: { contentType: type },
      }),
      pumping,
    ]);
  } catch {
    // สตรีมพังกลางทาง = ไบต์ไม่ตรงกับที่แจ้ง หรือการเชื่อมต่อหลุด
    // ลบเศษที่อาจเขียนไปแล้ว ไม่ปล่อยให้ค้างกินโควตา
    await env.PHOTOS_BUCKET.delete(key);
    return json(400, "อัปโหลดคลิปไม่สำเร็จ ลองใหม่อีกครั้ง");
  }

  const size = object?.size ?? 0;
  if (!size || size > MAX_VIDEO_BYTES) {
    await env.PHOTOS_BUCKET.delete(key);
    return json(413, `คลิปใหญ่เกิน ${formatBytes(MAX_VIDEO_BYTES)}`);
  }

  await recordObject(db, {
    bucketName: "photos",
    key,
    sizeBytes: size,
    kind: "video",
    familyId,
    uploadedBy: sessionUser.id,
  });

  return Response.json({ key, size });
}

const json = (status: number, message: string) =>
  Response.json({ error: message }, { status });
