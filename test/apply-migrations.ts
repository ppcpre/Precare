import { applyD1Migrations, env } from "cloudflare:test";

// สร้าง schema จริงจาก migrations/ ก่อนรันเทสต์ทุกครั้ง
await applyD1Migrations(env.DB, env.TEST_MIGRATIONS);
