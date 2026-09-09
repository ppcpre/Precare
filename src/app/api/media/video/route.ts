import { and, eq } from "drizzle-orm";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getDb } from "@/db";
import { familyMembers, user as userTable } from "@/db/schema";
import { getSessionUser } from "@/lib/session";
import {
  MAX_VIDEO_BYTES,
  StorageQuotaError,
  VIDEO_PART_BYTES,
  assertRoomFor,
  formatBytes,
  recordObject,
} from "@/lib/storage";

/**
 * รับไฟล์วิดีโอเข้า R2 แบบ multipart
 *
 * **ทำไมต้องแบ่งชิ้น** Cloudflare จำกัด body ต่อหนึ่งคำขอไว้ที่ 100 MB
 * บนแพลนฟรี คำขอที่เกินถูกตอบ 413 ที่ขอบตั้งแต่ยังไม่ถึง worker
 * ไฟล์ 500 MB จึงส่งเป็นคำขอเดียวไม่ได้ ไม่ว่าโค้ดจะเขียนดีแค่ไหน
 * https://developers.cloudflare.com/workers/platform/limits/
 *
 * ขั้นตอน: start -> part × N -> complete (หรือ abort ถ้าพัง)
 *
 * ทำไมไม่ใช้ Server Action: Server Action อ่าน body ทั้งก้อนเข้าหน่วยความจำ
 * ก่อนถึงจะเรียกโค้ดเราได้ ซึ่งชนเพดาน 128 MB ของ worker
 * เส้นทางนี้สตรีมเข้า R2 ใช้หน่วยความจำคงที่ไม่ว่าชิ้นจะใหญ่แค่ไหน
 *
 * ทำไม metadata ไม่มาทางนี้: วันที่ ประเภท และคำบรรยาย เป็นข้อมูลสุขภาพ
 * ถ้าใส่ใน query string มันจะไปโผล่ใน access log ของ Cloudflare
 * เส้นทางนี้จึงรับแต่ "ไบต์" ส่วน metadata ไปกับ action addVideo ในขาที่สอง
 *
 * ⚠️ เส้นทางนี้ไม่ได้ผ่าน safe-action chain จึงไม่ถูก scripts/check-authz.mjs
 *    ตรวจให้ การตรวจสิทธิ์ตรงนี้เขียนมือ และมีเทสต์ใน e2e/media-access.spec.ts คุมไว้
 */
export async function POST(req: Request) {
  const gate = await authorize();
  if ("error" in gate) return gate.error;
  const { familyId, userId } = gate;

  const { env } = await getCloudflareContext({ async: true });
  const phase = req.headers.get("x-upload-phase") ?? "start";

  if (phase === "start") return start(req, env.PHOTOS_BUCKET, familyId);
  if (phase === "part") return part(req, env.PHOTOS_BUCKET, familyId);
  if (phase === "complete") return complete(req, env.PHOTOS_BUCKET, familyId, userId);
  if (phase === "abort") return abort(req, env.PHOTOS_BUCKET, familyId);
  return json(400, "ขั้นตอนอัปโหลดไม่ถูกต้อง");
}

/** เปิดรอบอัปโหลด — กันโควตาไว้ตั้งแต่ตอนนี้ ไม่ใช่ตอนอัปเสร็จ */
async function start(req: Request, bucket: R2Bucket, familyId: string) {
  const type = req.headers.get("x-video-type") ?? "";
  const ext = extOf(type);
  if (!ext) return json(415, "รองรับเฉพาะไฟล์ mp4 และ mov");

  const declared = Number(req.headers.get("x-video-size") ?? 0);
  if (!declared || Number.isNaN(declared)) return json(411, "ไม่รู้ขนาดไฟล์");
  if (declared > MAX_VIDEO_BYTES) {
    return json(413, `คลิปใหญ่เกิน ${formatBytes(MAX_VIDEO_BYTES)}`);
  }

  try {
    await assertRoomFor(await getDb(), declared, "video");
  } catch (e) {
    if (e instanceof StorageQuotaError) return json(507, e.message);
    throw e;
  }

  const key = `family/${familyId}/videos/${crypto.randomUUID()}.${ext}`;
  const mpu = await bucket.createMultipartUpload(key, { httpMetadata: { contentType: type } });
  return Response.json({ key, uploadId: mpu.uploadId, partBytes: VIDEO_PART_BYTES });
}

/** ส่งชิ้นหนึ่งชิ้น — ตอบ etag กลับไปให้ client เก็บไว้ใช้ตอน complete */
async function part(req: Request, bucket: R2Bucket, familyId: string) {
  const target = targetOf(req, familyId);
  if (!target) return json(404, "ไม่พบรอบอัปโหลดนี้");

  const partNumber = Number(req.headers.get("x-part-number") ?? 0);
  if (!Number.isInteger(partNumber) || partNumber < 1 || partNumber > 10_000) {
    return json(400, "ลำดับชิ้นไม่ถูกต้อง");
  }

  const declared = Number(req.headers.get("content-length") ?? 0);
  if (!declared || Number.isNaN(declared)) return json(411, "ไม่รู้ขนาดชิ้น");
  if (declared > VIDEO_PART_BYTES) return json(413, "ชิ้นใหญ่เกินกำหนด");
  if (!req.body) return json(400, "ไม่มีข้อมูลไฟล์");

  /**
   * ต้องผ่าน FixedLengthStream ไม่ใช่ส่ง req.body ให้ R2 ตรงๆ
   *
   * R2 รับสตรีมได้เฉพาะสตรีมที่รู้ความยาวแน่นอน แต่ body ที่มาถึง route
   * ผ่าน OpenNext แล้วไม่มีความยาวติดมา ("Provided readable stream must have
   * a known length") — เจอตอนเทสต์ ไม่ใช่ตอนอ่านเอกสาร
   *
   * ผลพลอยได้: ถ้าไบต์จริงไม่ตรงกับที่แจ้ง สตรีมจะพังเอง การเขียนจึงล้มทันที
   */
  const fixed = new FixedLengthStream(declared);
  const pumping = req.body.pipeTo(fixed.writable);

  try {
    const mpu = bucket.resumeMultipartUpload(target.key, target.uploadId);
    const [uploaded] = await Promise.all([mpu.uploadPart(partNumber, fixed.readable), pumping]);
    return Response.json({ partNumber: uploaded.partNumber, etag: uploaded.etag });
  } catch {
    // ไม่ abort ตรงนี้ — client ยังลองส่งชิ้นเดิมซ้ำได้ ถ้าเลิกจริงค่อยเรียก abort
    return json(400, "ส่งคลิปบางส่วนไม่สำเร็จ ลองใหม่อีกครั้ง");
  }
}

/** ปิดรอบ ประกอบไฟล์ แล้วค่อยบันทึกลงบัญชีพื้นที่ */
async function complete(req: Request, bucket: R2Bucket, familyId: string, userId: string) {
  const target = targetOf(req, familyId);
  if (!target) return json(404, "ไม่พบรอบอัปโหลดนี้");

  let parts: R2UploadedPart[];
  try {
    const body = (await req.json()) as { parts?: unknown };
    if (!Array.isArray(body.parts) || body.parts.length === 0) throw new Error("no parts");
    parts = body.parts as R2UploadedPart[];
  } catch {
    return json(400, "รายการชิ้นไม่ถูกต้อง");
  }

  let object;
  try {
    const mpu = bucket.resumeMultipartUpload(target.key, target.uploadId);
    object = await mpu.complete(parts);
  } catch {
    return json(400, "ประกอบคลิปไม่สำเร็จ ลองอัปใหม่อีกครั้ง");
  }

  // ขนาดจริงเช็คได้ก็ต่อเมื่อประกอบเสร็จแล้ว — ที่แจ้งไว้ตอน start เชื่อไม่ได้
  const size = object?.size ?? 0;
  if (!size || size > MAX_VIDEO_BYTES) {
    await bucket.delete(target.key);
    return json(413, `คลิปใหญ่เกิน ${formatBytes(MAX_VIDEO_BYTES)}`);
  }

  const db = await getDb();
  try {
    await assertRoomFor(db, size, "video");
  } catch (e) {
    // โควตาเต็มระหว่างทาง (คนอื่นในบ้านอัปพร้อมกัน) — ลบทิ้ง ไม่ปล่อยให้เกิน
    await bucket.delete(target.key);
    if (e instanceof StorageQuotaError) return json(507, e.message);
    throw e;
  }

  await recordObject(db, {
    bucketName: "photos",
    key: target.key,
    sizeBytes: size,
    kind: "video",
    familyId,
    uploadedBy: userId,
  });

  return Response.json({ key: target.key, size });
}

/**
 * ยกเลิกรอบที่ทำไม่สำเร็จ
 *
 * สำคัญกว่าที่เห็น: R2 คิดพื้นที่ของ multipart ที่ค้างอยู่ด้วย
 * ถ้าไม่มีทางยกเลิก คลิปที่อัปไปครึ่งทางแล้วปิดแอปจะกินโควตาไปเรื่อยๆ
 * โดยไม่มีแถวใน storage_objects ให้เห็นเลยว่ามีอยู่
 */
async function abort(req: Request, bucket: R2Bucket, familyId: string) {
  const target = targetOf(req, familyId);
  if (!target) return json(404, "ไม่พบรอบอัปโหลดนี้");
  try {
    await bucket.resumeMultipartUpload(target.key, target.uploadId).abort();
  } catch {
    // ยกเลิกไม่สำเร็จก็ไม่ต้องทำให้ผู้ใช้เห็น error — รอบนั้นจบไปแล้วในสายตาเขา
  }
  return Response.json({ ok: true });
}

/**
 * ตรวจว่า key ที่ client ส่งมาเป็นของครอบครัวตัวเองจริง
 *
 * นี่คือด่านกัน IDOR ทั้งหมดของเส้นทางนี้ — uploadId เป็นของ R2 เดาไม่ได้ก็จริง
 * แต่ key เดาได้ ถ้าไม่ผูกกับ familyId จาก session สมาชิกครอบครัวหนึ่ง
 * จะเขียนทับรอบอัปโหลดของอีกครอบครัวได้
 */
function targetOf(req: Request, familyId: string) {
  const key = req.headers.get("x-upload-key") ?? "";
  const uploadId = req.headers.get("x-upload-id") ?? "";
  if (!uploadId) return null;
  const ok = new RegExp(
    `^family/${familyId}/videos/[0-9a-f-]{36}\\.(mp4|mov)$`,
  ).test(key);
  return ok ? { key, uploadId } : null;
}

/** นามสกุลต้องตรงกับชนิดจริง เพราะเส้นทางเสิร์ฟไฟล์ใช้นามสกุลตัดสิน Range/206 */
const extOf = (type: string) =>
  type === "video/mp4" ? "mp4" : type === "video/quicktime" ? "mov" : null;

/** อ่าน session + สิทธิ์ครั้งเดียว ใช้ร่วมกันทุกขั้นตอน */
async function authorize() {
  const sessionUser = await getSessionUser();
  if (!sessionUser) return { error: json(401, "ยังไม่ได้เข้าสู่ระบบ") };

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
  if (!familyId) return { error: json(403, "ยังไม่ได้เลือกครอบครัว") };
  // viewer ดูได้อย่างเดียว — ต้องกันตรงนี้ด้วย ไม่ใช่กันแค่ที่ปุ่มบนหน้าจอ
  if (row.role !== "owner" && row.role !== "editor") {
    return { error: json(403, "คุณมีสิทธิ์ดูอย่างเดียวในครอบครัวนี้") };
  }
  return { familyId, userId: sessionUser.id };
}

const json = (status: number, message: string) =>
  Response.json({ error: message }, { status });
