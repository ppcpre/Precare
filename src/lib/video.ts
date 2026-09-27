/**
 * เตรียมวิดีโอในเบราว์เซอร์ก่อนอัปโหลด
 *
 * ต่างจากรูปตรงที่ **ย่อไม่ได้** — ไฟล์ที่อัปขึ้นไปคือไฟล์เดียวกับที่มือถือถ่ายไว้
 * ทางเดียวที่คุมปริมาณได้คือปฏิเสธตั้งแต่ตอนเลือก จึงต้องอ่านความยาวให้ได้
 * ก่อนเริ่มอัปโหลด ไม่ใช่ปล่อยขึ้นไปแล้วค่อยให้ server บอกว่าไม่ผ่าน
 */

/**
 * รับ mp4 และ mov
 *
 * .mov จาก iPhone บางไฟล์เข้ารหัสเป็น HEVC ซึ่งเบราว์เซอร์บนแอนดรอยด์
 * หลายรุ่นถอดรหัสไม่ได้ — แปลงให้ไม่ได้ด้วย เพราะ Worker ไม่มี ffmpeg
 * และ ffmpeg.wasm ~30 MB เกินงบ bundle ทั้งโปรเจกต์ (3 MiB)
 *
 * ทางที่เลือก: **รับไว้ก่อน แล้วบอกความจริง** ไฟล์ที่เครื่องนี้อ่านไม่ได้
 * จะอัปได้อยู่ แต่ไม่มีหน้าปกและไม่รู้ความยาว และอาจเล่นไม่ได้บนบางเครื่อง
 * ดีกว่าปฏิเสธไปเลยแล้วคนอัปคลิปของตัวเองไม่ได้ทั้งที่ไฟล์ไม่ได้เสีย
 */
export const VIDEO_MIME = ["video/mp4", "video/quicktime"];

/** ตัวเลือกของ input file — แอนดรอยด์บางเครื่องส่ง type ว่างมา ต้องมีนามสกุลด้วย */
export const VIDEO_ACCEPT = "video/mp4,video/quicktime,.mp4,.mov";

/** เดาชนิดจากนามสกุล ใช้ตอน picker ไม่ส่ง MIME มาให้ */
export function videoMimeOf(file: File) {
  if (VIDEO_MIME.includes(file.type)) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  return null;
}

export const VIDEO_HELP =
  "ถ้าอยากให้เปิดได้ทุกเครื่อง ตั้งกล้องเป็นรูปแบบ “เข้ากันได้มากที่สุด” (iPhone: ตั้งค่า → กล้อง → รูปแบบ)";

export type VideoInfo = { durationMs: number; width: number; height: number };

/**
 * แปล error ของ <video> ให้บอกได้ว่าเกิดอะไรขึ้น
 *
 * "เปิดไฟล์วิดีโอไม่ได้" เฉยๆ ทำให้แยกไม่ออกระหว่าง "ไฟล์นี้เข้ารหัสแบบที่
 * เบราว์เซอร์นี้เล่นไม่ได้" กับ "โดน CSP บล็อกตั้งแต่ยังไม่ทันอ่านไฟล์"
 * ซึ่งอย่างหลังเคยเกิดจริงและทำให้ mp4 ที่ปกติดีทุกไฟล์ขึ้นข้อความเดียวกันหมด
 */
function mediaError(v: HTMLVideoElement) {
  const code = v.error?.code;
  if (code === 4) return "ไฟล์นี้เบราว์เซอร์เปิดไม่ได้ — ลองอัดใหม่เป็น mp4 (H.264)";
  if (code === 3) return "ไฟล์วิดีโอเสียหรือถอดรหัสไม่ได้";
  if (code === 2) return "อ่านไฟล์วิดีโอไม่สำเร็จ";
  // ไม่มี MediaError เลย ทั้งที่ error event ยิงออกมา = ถูกบล็อกก่อนถึงตัวถอดรหัส
  return "เปิดไฟล์วิดีโอไม่ได้ (เบราว์เซอร์บล็อกก่อนอ่านไฟล์)";
}


/**
 * บังคับให้ promise จบเสมอ ไม่ว่าจะสำเร็จ ล้มเหลว หรือเงียบหาย
 *
 * <video> ในเบราว์เซอร์ **ไม่รับประกันว่าจะยิง event สักตัว** — Safari บนมือถือ
 * ไม่เริ่มโหลด blob ให้กับ element ที่ไม่ได้อยู่ในหน้า และการ seek ที่ไปไม่ถึง
 * ก็เงียบไปเฉยๆ ไม่มีทั้ง loadedmetadata และ error
 *
 * ผลคือหน้าจอค้างตลอดกาลโดยไม่มีข้อความอะไรเลย และไม่มีคำขอออกจากเครื่องด้วยซ้ำ
 * (เจอจริงตอนแนบวิดีโอบน Safari) — ตัวจับเวลานี้คือกันไม่ให้ "เงียบ" กลายเป็น "ค้าง"
 */
export function withDeadline<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * ให้ element อยู่ในหน้าจริงๆ ระหว่างอ่านไฟล์
 *
 * Safari บนมือถือเลื่อนการโหลดสื่อของ element ที่ไม่ได้อยู่ใน DOM ออกไป
 * แบบไม่มีกำหนด ซ่อนด้วย display:none ก็ไม่ได้ด้วยเหตุผลเดียวกัน
 * จึงวางไว้นอกจอแทน — ผู้ใช้ไม่เห็น แต่เบราว์เซอร์ถือว่าต้องโหลด
 */
function mount(v: HTMLVideoElement) {
  v.style.cssText = "position:fixed;left:-9999px;top:0;width:1px;height:1px;opacity:0";
  v.setAttribute("playsinline", "");
  v.muted = true;
  document.body.appendChild(v);
}

const unmount = (v: HTMLVideoElement) => v.remove();

/** อ่าน metadata อย่างเดียว ไม่ต้องถอดรหัสภาพ จึงเร็วกว่าการดึงเฟรมมาก */
const PROBE_TIMEOUT_MS = 12_000;
/** ต้องถอดรหัสและ seek ด้วย ให้เวลามากกว่า แต่ต้องมีเพดาน */
const POSTER_TIMEOUT_MS = 20_000;

/** อ่านความยาวและขนาดภาพ โดยไม่ต้องเล่นไฟล์ */
export function probeVideo(file: File): Promise<VideoInfo> {
  return withDeadline(rawProbe(file), PROBE_TIMEOUT_MS, "อ่านไฟล์วิดีโอนานเกินไป");
}

function rawProbe(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
      unmount(v);
      fn();
    };
    v.onloadedmetadata = () => {
      const info = {
        durationMs: Math.round(v.duration * 1000),
        width: v.videoWidth,
        height: v.videoHeight,
      };
      // duration เป็น Infinity ได้กับไฟล์ที่ moov atom อยู่ท้ายไฟล์
      // ปล่อยผ่านไม่ได้ เพราะเพดานความยาวจะกลายเป็นไม่มีผล
      if (!Number.isFinite(info.durationMs) || info.durationMs <= 0) {
        done(() => reject(new Error("อ่านความยาวคลิปไม่ได้")));
        return;
      }
      done(() => resolve(info));
    };
    v.onerror = () => done(() => reject(new Error(mediaError(v))));
    mount(v);
    v.src = url;
    // Safari ต้องสั่ง load() เอง ตั้ง src อย่างเดียวบางครั้งไม่เริ่มโหลด
    v.load();
  });
}

/**
 * ดึงเฟรมมาทำหน้าปก
 *
 * ถ้าไม่มีหน้าปก กริดอัลบั้มจะเป็นกล่องดำล้วนทั้งแถวและแยกคลิปกันไม่ออกเลย
 * สร้างฝั่ง server ไม่ได้ จึงต้องทำตรงนี้ตอนเลือกไฟล์
 *
 * ไม่ใช้เฟรมที่ 0 เพราะคลิปจากมือถือมักเริ่มด้วยเฟรมมืดหรือเบลอตอนกล้องยังโฟกัสไม่เข้า
 * ขยับไปหนึ่งในสี่ของคลิป (ไม่เกิน 2 วินาที) ได้ภาพที่บอกได้ว่าคลิปนี้คืออะไร
 */
export function posterFrame(file: File, maxEdge = 640): Promise<Blob> {
  return withDeadline(rawPoster(file, maxEdge), POSTER_TIMEOUT_MS, "ดึงหน้าปกนานเกินไป");
}

function rawPoster(file: File, maxEdge: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;

    const fail = (msg: string) => {
      URL.revokeObjectURL(url);
      unmount(v);
      reject(new Error(msg));
    };

    v.onloadeddata = () => {
      v.currentTime = Math.min(2, (v.duration || 0) / 4);
    };
    v.onseeked = () => {
      const scale = Math.min(1, maxEdge / Math.max(v.videoWidth, v.videoHeight));
      const canvas = document.createElement("canvas");
      canvas.width = Math.max(1, Math.round(v.videoWidth * scale));
      canvas.height = Math.max(1, Math.round(v.videoHeight * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) return fail("เบราว์เซอร์นี้สร้างหน้าปกไม่ได้");
      ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(url);
          unmount(v);
          if (blob) resolve(blob);
          else reject(new Error("สร้างหน้าปกไม่ได้"));
        },
        "image/webp",
        0.8,
      );
    };
    v.onerror = () => fail(mediaError(v));
    mount(v);
    v.src = url;
    v.load();
  });
}

/** 0:12 · 1:05 — ป้ายเวลาบนไทล์ */
export function formatClip(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
