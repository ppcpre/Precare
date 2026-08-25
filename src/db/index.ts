import { drizzle } from "drizzle-orm/d1";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

/**
 * ต้องเรียกใหม่ทุก request — ห้าม cache ไว้ที่ module scope
 * เพราะ binding ผูกกับ request context ของ Workers
 */
export async function getDb() {
  const { env } = await getCloudflareContext({ async: true });
  return drizzle(env.DB, { schema });
}

export type Db = Awaited<ReturnType<typeof getDb>>;
export { schema };
