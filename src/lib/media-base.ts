import "server-only";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { createMediaToken, familyScope, userScope } from "@/lib/media-token";
import { getMediaSecret } from "@/lib/media-secret";
import type { MediaBase } from "@/lib/media-src";

/**
 * ออกตั๋วเข้าถึงไฟล์ให้หน้าที่กำลัง render
 *
 * ออกต่อ "ขอบเขต" ไม่ใช่ต่อไฟล์ — หน้าอัลบั้มหน้าเดียวมีรูป 30 ใบ
 * ถ้าเซ็นทีละใบคือเซ็น 30 ครั้งต่อการเปิดหนึ่งหน้า
 *
 * ⚠️ ผู้เรียกต้องผ่าน requireFamilyContext มาแล้วเท่านั้น ฟังก์ชันนี้ไม่ตรวจสิทธิ์ซ้ำ
 *    มันแค่ "เซ็น" สิ่งที่ผู้เรียกตรวจมาแล้ว
 */
async function base(scope: string): Promise<MediaBase | null> {
  const { env } = await getCloudflareContext({ async: true });
  const origin = env.MEDIA_ORIGIN?.replace(/\/+$/, "");
  // ไม่ได้ตั้ง = ยังไม่ได้ deploy worker ตัวนั้น ให้แอปเสิร์ฟเองเหมือนเดิม
  if (!origin) return null;
  return { origin, token: await createMediaToken(await getMediaSecret(env.DB), scope) };
}

export const familyMediaBase = (familyId: string) => base(familyScope(familyId));
export const userMediaBase = (userId: string) => base(userScope(userId));
