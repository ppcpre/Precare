#!/usr/bin/env node
/**
 * T6.6 — ตรวจความพร้อมก่อน go-live
 *
 * เขียนเป็นสคริปต์แทน checklist ที่ไล่ติ๊กมือ เพราะสิ่งที่ทำให้ production พัง
 * รอบก่อนคือ worker ถูก deploy ขึ้นไปแล้วแต่ **ไม่มี secret และ D1 ยังไม่ได้
 * migrate เลยสักไฟล์** ซึ่งเป็นสองข้อที่อยู่ใน checklist อยู่แล้ว แต่ไม่มีใคร
 * ไปเปิดดูจริง หน้าเว็บตอบ 200 ได้เพราะ /login แทบไม่แตะ DB
 *
 * ข้อที่เครื่องตรวจไม่ได้ (redirect URI ใน Google Console, billing alert,
 * ทดสอบมือถือจริง) จะขึ้นเป็นรายการให้คนไปกดเอง ไม่ใช่แกล้งทำเป็นผ่าน
 *
 * ใช้: node scripts/go-live-check.mjs [--env dev]
 */
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// __dirname ผ่าน fileURLToPath — path ของโปรเจกต์นี้มีวงเล็บและช่องว่าง
// การใช้ new URL().pathname จะได้ %20 ติดมา
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const target = process.argv.includes("--env") ? process.argv[process.argv.indexOf("--env") + 1] : null;
const envArgs = target ? ["--env", target] : [];
const label = target ?? "production";

const results = [];
const ok = (name, detail = "") => results.push({ state: "ok", name, detail });
const fail = (name, detail) => results.push({ state: "fail", name, detail });
const manual = (name, detail) => results.push({ state: "manual", name, detail });

function wrangler(args) {
  return execFileSync("npx", ["wrangler", ...args], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
}

// ── 1. secret ของ worker ────────────────────────────────────────────────
// นี่คือข้อที่พลาดจริงมาแล้ว: worker deploy สำเร็จ หน้าแรกตอบ 200
// แต่ทุกอย่างที่แตะ auth พังหมดเพราะไม่มี BETTER_AUTH_SECRET
const REQUIRED_SECRETS = ["BETTER_AUTH_SECRET", "GOOGLE_CLIENT_SECRET"];
try {
  const list = JSON.parse(wrangler(["secret", "list", ...envArgs]));
  const have = new Set(list.map((s) => s.name));
  const missing = REQUIRED_SECRETS.filter((s) => !have.has(s));
  if (missing.length) {
    fail(
      `secret ของ worker (${label})`,
      `ขาด ${missing.join(", ")}\n` +
        missing.map((s) => `      npx wrangler secret put ${s}${target ? ` --env ${target}` : ""}`).join("\n"),
    );
  } else {
    ok(`secret ของ worker (${label})`, `ครบ ${REQUIRED_SECRETS.length} ตัว`);
  }
} catch (e) {
  fail(`secret ของ worker (${label})`, `อ่านไม่ได้ — ล็อกอิน wrangler แล้วหรือยัง (${e.message.split("\n")[0]})`);
}

// ── 2. migration บน D1 ของจริง ──────────────────────────────────────────
const dbName = target === "dev" ? "precare-dev-db" : "precare-db";
try {
  const out = wrangler(["d1", "migrations", "list", dbName, "--remote", ...envArgs]);
  const pending = [...out.matchAll(/^│ (\d{4}_[\w-]+\.sql)/gm)].map((m) => m[1]);
  if (pending.length) {
    fail(
      `migration ของ ${dbName}`,
      `ยังไม่ได้รัน ${pending.length} ไฟล์: ${pending.join(", ")}\n` +
        `      workflow deploy รันให้เองตอน merge — ถ้าจะรันเองใช้ npx wrangler d1 migrations apply ${dbName} --remote${target ? ` --env ${target}` : ""}`,
    );
  } else {
    ok(`migration ของ ${dbName}`, "ครบทุกไฟล์");
  }
} catch (e) {
  fail(`migration ของ ${dbName}`, e.message.split("\n")[0]);
}

// ── 3. ขนาด bundle ──────────────────────────────────────────────────────
// อ่านจาก dry-run เท่านั้น อย่า gzip worker.js ตรงๆ — ไฟล์นั้นเป็นแค่ entry ~2 KB
try {
  const out = execFileSync("npx", ["wrangler", "deploy", "--dry-run", ...envArgs], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const gzip = Number(out.match(/gzip:\s*([\d.]+)\s*KiB/)?.[1]);
  const LIMIT = 3072;
  if (!gzip) fail("ขนาด bundle", "อ่านค่าจาก dry-run ไม่ได้");
  else if (gzip >= LIMIT) fail("ขนาด bundle", `${gzip} KiB เกินเพดาน free plan ${LIMIT} KiB`);
  else ok("ขนาด bundle", `${gzip} KiB / ${LIMIT} KiB (${Math.round((gzip / LIMIT) * 100)}%)`);
} catch (e) {
  fail("ขนาด bundle", e.message.split("\n")[0]);
}

// ── 4. ความลับต้องไม่หลุดขึ้น git ────────────────────────────────────────
try {
  const tracked = execFileSync("git", ["ls-files"], { cwd: root, encoding: "utf8" }).split("\n");
  const leaked = tracked.filter((f) => f === ".dev.vars" || f.endsWith("/.dev.vars"));
  if (leaked.length) fail("ความลับใน git", `${leaked.join(", ")} ถูก track อยู่ — ต้องถอดออกและ rotate ทันที`);
  else ok("ความลับใน git", ".dev.vars ไม่ได้ถูก track");
} catch {
  fail("ความลับใน git", "ตรวจไม่ได้");
}

// ── 5. BETTER_AUTH_URL ต้องตรงกับที่ deploy จริง ─────────────────────────
// Better Auth ปฏิเสธทุก request ที่ origin ไม่ตรง baseURL ด้วย "Invalid origin"
// ตั้งผิด = ล็อกอินไม่ได้เลยทั้งเว็บ แต่หน้าอื่นดูปกติดี
try {
  const cfg = readFileSync(path.join(root, "wrangler.jsonc"), "utf8");
  const block = target ? cfg.slice(cfg.indexOf(`"${target}"`)) : cfg;
  const url = block.match(/"BETTER_AUTH_URL":\s*"([^"]+)"/)?.[1];
  const expected = target === "dev"
    ? "https://precare-dev.precare.workers.dev"
    : "https://precare.precare.workers.dev";
  if (url === expected) ok("BETTER_AUTH_URL", url);
  else fail("BETTER_AUTH_URL", `เป็น ${url} แต่ควรเป็น ${expected}`);
} catch {
  fail("BETTER_AUTH_URL", "อ่าน wrangler.jsonc ไม่ได้");
}

// ── 6. ข้อที่ต้องให้คนไปกดเอง ────────────────────────────────────────────
manual(
  "Google OAuth redirect URI",
  "Google Cloud Console > Credentials > OAuth client\n" +
    "      ต้องมี https://precare.precare.workers.dev/api/auth/callback/google\n" +
    "      และ Publishing status ต้องเป็น Production ไม่ใช่ Testing\n" +
    "      (ถ้าเป็น Testing refresh token จะหมดอายุทุก 7 วันแล้วพังเงียบ)",
);
manual("Cloudflare Web Analytics", "เปิดใน dashboard > Web Analytics (ฟรี ไม่กระทบ bundle)");
manual("Billing alert", "dashboard > Notifications > Billing — กันเซอร์ไพรส์ตอน R2/D1 เกิน free tier");
manual("ทดสอบมือถือจริง (T6.4)", "iOS Safari + Android Chrome · HEIC จาก iPhone · safe area ของ bottom nav");

// ── สรุป ────────────────────────────────────────────────────────────────
const mark = { ok: "✅", fail: "❌", manual: "🔲" };
console.log(`\ngo-live check — ${label}\n${"─".repeat(56)}`);
for (const r of results) {
  console.log(`${mark[r.state]} ${r.name}`);
  if (r.detail) console.log(`      ${r.detail}`);
}

const failed = results.filter((r) => r.state === "fail");
const todo = results.filter((r) => r.state === "manual");
console.log("─".repeat(56));
console.log(`ตรวจอัตโนมัติ: ผ่าน ${results.filter((r) => r.state === "ok").length} · ไม่ผ่าน ${failed.length}`);
console.log(`ต้องกดเอง: ${todo.length} ข้อ`);

if (failed.length) {
  console.log("\nยังขึ้น production ไม่ได้ — แก้ข้อที่ ❌ ก่อน");
  process.exit(1);
}
console.log("\nข้อที่เครื่องตรวจได้ผ่านหมด — เหลือข้อ 🔲 ที่ต้องยืนยันด้วยตาคน");
