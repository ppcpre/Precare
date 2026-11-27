import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * เสิร์ฟไฟล์จาก bucket public (precare-assets)
 *
 * ต่างจาก /api/media ตรงที่ **ไม่ต้องล็อกอิน และ cache แบบ public ได้**
 * เพราะในนี้มีแต่ภาพประกอบของระบบ (รูปเทียบขนาดรายสัปดาห์) ไม่มีข้อมูลผู้ใช้
 * แยกเป็นคนละ route แทนที่จะใส่ flag ในตัวเดียว เพื่อไม่ให้มีทางพลาด
 * ทำไฟล์ส่วนตัวหลุดเป็น public ด้วยการส่ง parameter ผิด
 *
 * ⚠️ ห้ามใส่อะไรที่เป็นของผู้ใช้ลง bucket นี้เด็ดขาด
 */
const SERVABLE = new Set(["image/webp", "image/png", "image/svg+xml"]);

export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const key = (await params).key.join("/");
  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.ASSETS_BUCKET.get(key);
  // ยังไม่ได้ใส่ไฟล์ = 404 ปกติ ฝั่ง UI มี fallback รออยู่แล้ว
  if (!obj) return new Response(null, { status: 404 });

  // อ่านทั้งก้อนด้วยเหตุผลเดียวกับ /api/media — ไฟล์เล็กและตัดปัญหาอายุของสตรีม
  // ไม่ตั้ง content-length เอง ปล่อยให้ runtime คำนวณจากไบต์จริง
  const bytes = await obj.arrayBuffer();
  const declared = obj.httpMetadata?.contentType ?? "";
  return new Response(bytes, {
    headers: {
      "content-type": SERVABLE.has(declared) ? declared : "application/octet-stream",
      // ภาพประกอบไม่เปลี่ยน ปล่อยให้ CDN เก็บยาวได้
      "cache-control": "public, max-age=31536000, immutable",
      "x-content-type-options": "nosniff",
    },
  });
}
