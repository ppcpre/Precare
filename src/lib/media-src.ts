/**
 * ที่อยู่ของไฟล์ — ใช้ได้ทั้งฝั่ง server และ client
 *
 * มีสองเส้นทาง
 * - worker เสิร์ฟไฟล์ (workers/media) เมื่อมี MEDIA_ORIGIN และมีตั๋ว
 * - /api/media ของแอปเอง เมื่อไม่มี — เป็นทางถอยที่ยังทำงานได้ครบ
 *
 * ทางถอยไม่ได้มีไว้เผื่อสวย ๆ: รูปโปรไฟล์เก็บ URL ลงฐานข้อมูลตั้งแต่ตอนอัป
 * จึงเป็น /api/media ตลอดไป และเทสต์ที่ไม่ได้ตั้ง MEDIA_ORIGIN ก็ยังเดินได้
 */
export interface MediaBase {
  /** ต้นทางของ worker เสิร์ฟไฟล์ เช่น https://precare-media.precare.workers.dev */
  origin: string;
  /** ตั๋วที่แอปเซ็นให้ ครอบคลุมทั้งขอบเขต (ครอบครัวหรือผู้ใช้) */
  token: string;
}

export function mediaUrl(base: MediaBase | null | undefined, key: string) {
  if (!base?.origin || !base.token) return `/api/media/${key}`;
  return `${base.origin}/${key}?t=${base.token}`;
}
