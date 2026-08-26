import { getCloudflareContext } from "@opennextjs/cloudflare";

/**
 * เสิร์ฟไฟล์จาก bucket public — ภาพเทียบขนาดรายสัปดาห์ (Phase 2) และ asset ระบบ
 * ไม่มีข้อมูลส่วนตัว จึง cache ยาวได้ และไม่ต้องมี session
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key?: string[] }> }) {
  const key = (await params).key?.join("/");
  if (!key) return new Response(null, { status: 404 });

  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.ASSETS_BUCKET.get(key);
  // ไม่มีไฟล์ = 404 เฉยๆ ฝั่ง UI มี fallback รออยู่แล้ว
  if (!obj) return new Response(null, { status: 404 });

  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "public, max-age=31536000, immutable",
    },
  });
}
