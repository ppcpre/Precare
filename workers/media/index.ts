/**
 * worker เสิร์ฟไฟล์ — ตัวเล็กที่สุดเท่าที่ทำได้
 *
 * เหตุผลที่ต้องแยกออกมาจากแอป: คำขอไฟล์ทุกเส้นเคยวิ่งเข้า worker ของแอป
 * ซึ่งเป็น Next.js ทั้งก้อน การปลุก isolate ใหม่หนึ่งครั้งกิน CPU 200-250 ms
 * ขณะที่เพดานแพลนฟรีคือ 10 ms — เครื่องเล่นวิดีโอยิงคำขอพร้อมกันหลายเส้น
 * จึงปลุก isolate พร้อมกันหลายตัวแล้วได้ Error 1102 (docs/project-plan.md 6.13)
 *
 * ตัวนี้ไม่มี Next, ไม่มี Better Auth, ไม่มี ORM — เย็นแล้วก็ยังตื่นเร็ว
 * สิทธิ์มาจากตั๋วที่แอปเซ็นให้ (src/lib/media-token.ts) ไม่ใช่ session
 */
import { verifyMediaToken } from "../../src/lib/media-token";
import { getMediaSecret } from "../../src/lib/media-secret";

export interface MediaEnv {
  PHOTOS_BUCKET: R2Bucket;
  DB: D1Database;
}

/** ชนิดที่ยอมให้เสิร์ฟ — กันไฟล์แปลกปลอมที่หลุดเข้า bucket มาทำงานในเบราว์เซอร์ */
const SERVABLE = new Set(["image/webp", "image/jpeg", "image/png", "video/mp4", "video/quicktime"]);
const VIDEO_EXT: Record<string, string> = { mp4: "video/mp4", mov: "video/quicktime" };

/**
 * อ่านหัว Range แบบที่วิดีโอใช้จริง คือ `bytes=<start>-` และ `bytes=<start>-<end>`
 * รูปแบบอื่นคืน null แล้วส่งทั้งไฟล์ ซึ่งถูกตามสเปกและง่ายกว่ารองรับให้ครบโดยไม่มีใครใช้
 */
function parseRange(header: string | null, size: number) {
  const m = /^bytes=(\d+)-(\d*)$/.exec(header?.trim() ?? "");
  if (!m) return null;
  const start = Number(m[1]);
  const end = m[2] === "" ? size - 1 : Number(m[2]);
  if (start >= size || end < start) return null;
  return { start, end: Math.min(end, size - 1) };
}

const COMMON = {
  // ห้าม public — CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
  "cache-control": "private, max-age=3600",
  "content-disposition": "inline",
  "x-content-type-options": "nosniff",
  // worker ตัวนี้เปิดสาธารณะ ตั๋วเป็นตัวกั้น — ปิดทางให้หน้าเว็บอื่นอ่านเนื้อไฟล์
  "cross-origin-resource-policy": "same-site",
};

export async function handleMedia(req: Request, env: MediaEnv): Promise<Response> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response(null, { status: 405 });
  }

  const url = new URL(req.url);

  // เช็คว่ายังมีชีวิตอยู่ — ไม่แตะ D1 ไม่แตะ R2 ไม่บอกอะไรที่เป็นความลับ
  // เทสต์ใช้รอให้ worker พร้อมก่อนเริ่ม และใช้เฝ้าตอน deploy จริงได้ด้วย
  if (url.pathname === "/healthz") return new Response("ok");
  // `/family/<id>/photos/<uuid>.webp` -> ตัด / ตัวหน้าออก
  const key = decodeURIComponent(url.pathname.slice(1));
  const token = url.searchParams.get("t") ?? "";

  // ทุกทางที่ไม่ผ่านตอบ 404 เหมือนกันหมด ตามหลักใน src/lib/authz.ts
  // คนนอกไม่ควรรู้ด้วยซ้ำว่าไฟล์นี้มีอยู่จริง หรือว่าตั๋วผิดตรงไหน
  if (!key || !token) return new Response(null, { status: 404 });

  const secret = await getMediaSecret(env.DB);
  if (!(await verifyMediaToken(secret, token, key))) return new Response(null, { status: 404 });

  const videoType = VIDEO_EXT[key.slice(key.lastIndexOf(".") + 1)];

  if (!videoType) {
    const obj = await env.PHOTOS_BUCKET.get(key);
    if (!obj) return new Response(null, { status: 404 });
    const declared = obj.httpMetadata?.contentType ?? "";
    const headers = {
      ...COMMON,
      "content-type": SERVABLE.has(declared) ? declared : "application/octet-stream",
    };
    // รูปถูกจำกัดที่ 5 MB ตั้งแต่ตอนอัปโหลด อ่านทั้งก้อนได้โดยไม่ต้องห่วงหน่วยความจำ
    // และตัดปัญหาสตรีมถูกยกเลิกกลางคันตอนผู้ใช้เปลี่ยนหน้าทิ้งไปทั้งหมด
    if (req.method === "HEAD") return new Response(null, { headers });
    return new Response(await obj.arrayBuffer(), { headers });
  }

  /**
   * วิดีโอเดินคนละทางกับรูป — เบราว์เซอร์ขอเป็นช่วงๆ ด้วยหัว Range เสมอ
   * ถ้าตอบทั้งไฟล์ทุกครั้ง การเลื่อนแถบเวลาเท่ากับโหลดใหม่ทั้งคลิป
   * และ Safari จะไม่เริ่มเล่นเลยถ้าไม่เห็น 206 กับ accept-ranges
   *
   * ห้ามบัฟเฟอร์ทั้งก้อนเหมือนรูป — คลิป 500 MB ในหน่วยความจำที่มีเพดาน 128 MB
   */
  const head = await env.PHOTOS_BUCKET.head(key);
  if (!head) return new Response(null, { status: 404 });

  const range = parseRange(req.headers.get("range"), head.size);
  const headers = {
    ...COMMON,
    "content-type": videoType,
    "accept-ranges": "bytes",
    ...(range
      ? {
          "content-range": `bytes ${range.start}-${range.end}/${head.size}`,
          "content-length": String(range.end - range.start + 1),
        }
      : { "content-length": String(head.size) }),
  };
  if (req.method === "HEAD") return new Response(null, { status: range ? 206 : 200, headers });

  const obj = range
    ? await env.PHOTOS_BUCKET.get(key, {
        range: { offset: range.start, length: range.end - range.start + 1 },
      })
    : await env.PHOTOS_BUCKET.get(key);
  if (!obj?.body) return new Response(null, { status: 404 });

  return new Response(obj.body, { status: range ? 206 : 200, headers });
}

export default {
  fetch: handleMedia,
} satisfies ExportedHandler<MediaEnv>;
