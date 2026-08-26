import { defineConfig } from "vitest/config";
import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import path from "node:path";
import { fileURLToPath } from "node:url";

const dir = path.dirname(fileURLToPath(import.meta.url));

// อ่าน migration ทั้งชุดตอน build config แล้วส่งเข้าไปให้ setup file ยิงลง D1
const migrations = await readD1Migrations(path.join(dir, "migrations"));

export default defineConfig({
  // ⚠️ @cloudflare/vitest-pool-workers v0.22 เปลี่ยน API แล้ว
  //    ไม่มี defineWorkersConfig / subpath "./config" อีกต่อไป
  //    ใช้ plugin cloudflareTest() แทน (มี codemod vitest-v3-to-v4 มาให้ในแพ็กเกจ)
  plugins: [
    cloudflareTest({
      miniflare: {
        compatibilityDate: "2026-08-01",
        compatibilityFlags: ["nodejs_compat"],
        // D1 จริงในหน่วยความจำ ไม่ใช่ mock
        d1Databases: ["DB"],
        bindings: { TEST_MIGRATIONS: migrations },
      },
    }),
  ],
  resolve: {
    alias: { "@": path.resolve(dir, "./src") },
  },
  test: {
    setupFiles: ["./test/apply-migrations.ts"],
    // เทสต์ในนี้รันใน workerd ซึ่งไม่มี node:process — ถ้าไม่กัน e2e/ ออก
    // vitest จะลากไฟล์ Playwright เข้ามารันแล้วพังด้วย error ที่ชี้ไปผิดที่
    include: ["test/**/*.test.ts"],
  },
});
