import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    // default ของ eslint-config-next
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // build output ของ OpenNext/wrangler — ไม่ใช่โค้ดเรา ห้าม lint
    ".open-next/**",
    ".wrangler/**",
    "cloudflare-env.d.ts",
    // ไฟล์ต้นทางของ design canvas เป็น HTML ที่ generate จาก design/gen.py
    "design/**",
  ]),
]);

export default eslintConfig;
