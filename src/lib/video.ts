/**
 * เตรียมวิดีโอในเบราว์เซอร์ก่อนอัปโหลด
 *
 * ต่างจากรูปตรงที่ **ย่อไม่ได้** — ไฟล์ที่อัปขึ้นไปคือไฟล์เดียวกับที่มือถือถ่ายไว้
 * ทางเดียวที่คุมปริมาณได้คือปฏิเสธตั้งแต่ตอนเลือก จึงต้องอ่านความยาวให้ได้
 * ก่อนเริ่มอัปโหลด ไม่ใช่ปล่อยขึ้นไปแล้วค่อยให้ server บอกว่าไม่ผ่าน
 */

/**
 * รับเฉพาะ mp4
 *
 * iPhone ถ่ายเป็น .mov (video/quicktime) ซึ่ง Android หลายรุ่นเปิดไม่ได้
 * ในแอปนี้คนในครอบครัวดูของกันและกัน ไฟล์ที่คนถ่ายเปิดได้แต่คนอื่นเปิดไม่ได้
 * จึงแย่กว่าการปฏิเสธตั้งแต่แรกพร้อมบอกวิธีตั้งกล้อง
 *
 * แปลงให้ไม่ได้: Worker ไม่มี ffmpeg และ ffmpeg.wasm ~30 MB
 * เกินงบ bundle ทั้งโปรเจกต์ (3 MiB)
 */
export const VIDEO_MIME = ["video/mp4"];

export const VIDEO_HELP =
  "ตั้งกล้องเป็นรูปแบบ “เข้ากันได้มากที่สุด” (iPhone: ตั้งค่า → กล้อง → รูปแบบ)";

export type VideoInfo = { durationMs: number; width: number; height: number };

/** อ่านความยาวและขนาดภาพ โดยไม่ต้องเล่นไฟล์ */
export function probeVideo(file: File): Promise<VideoInfo> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "metadata";
    v.muted = true;
    const done = (fn: () => void) => {
      URL.revokeObjectURL(url);
      v.removeAttribute("src");
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
    v.onerror = () => done(() => reject(new Error("เปิดไฟล์วิดีโอไม่ได้")));
    v.src = url;
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
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const v = document.createElement("video");
    v.preload = "auto";
    v.muted = true;
    v.playsInline = true;

    const fail = (msg: string) => {
      URL.revokeObjectURL(url);
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
          if (blob) resolve(blob);
          else reject(new Error("สร้างหน้าปกไม่ได้"));
        },
        "image/webp",
        0.8,
      );
    };
    v.onerror = () => fail("เปิดไฟล์วิดีโอไม่ได้");
    v.src = url;
  });
}

/** 0:12 · 1:05 — ป้ายเวลาบนไทล์ */
export function formatClip(ms: number) {
  const total = Math.round(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, "0")}`;
}
