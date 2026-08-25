import type { Config } from "drizzle-kit";

export default {
  schema: "./src/db/schema/index.ts",
  out: "./migrations",
  dialect: "sqlite",
  // ไม่ใส่ dbCredentials — เรา generate SQL อย่างเดียว
  // แล้วให้ `wrangler d1 migrations apply` เป็นคนยิงลง D1
} satisfies Config;
