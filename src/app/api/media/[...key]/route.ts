import { getCloudflareContext } from "@opennextjs/cloudflare";
import { getSessionUser } from "@/lib/session";

/**
 * เสิร์ฟไฟล์จาก bucket private
 *
 * ต้องมี session ถึงจะดูได้ และตั้ง cache เป็น private เท่านั้น
 * ห้ามใส่ public เพราะ CDN จะเก็บไฟล์ส่วนตัวไว้แจกคนอื่น
 */
export async function GET(_req: Request, { params }: { params: Promise<{ key: string[] }> }) {
  const user = await getSessionUser();
  if (!user) return new Response(null, { status: 401 });

  const key = (await params).key.join("/");
  const { env } = await getCloudflareContext({ async: true });
  const obj = await env.PHOTOS_BUCKET.get(key);
  if (!obj) return new Response(null, { status: 404 });

  return new Response(obj.body, {
    headers: {
      "content-type": obj.httpMetadata?.contentType ?? "application/octet-stream",
      "cache-control": "private, max-age=3600",
      "content-length": String(obj.size),
    },
  });
}
