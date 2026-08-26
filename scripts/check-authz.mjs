#!/usr/bin/env node
/**
 * ตรวจว่าโค้ดยังตรงกับ permission matrix ใน docs/architecture.md
 *
 * D1 ไม่มี row-level security ความปลอดภัยทั้งหมดอยู่ที่โค้ด
 * ไฟล์นี้จึงกันการเพี้ยนเชิงโครงสร้าง 3 อย่าง:
 *   1) ทุกหน้าในโซนแอปต้องมีด่านตรวจสิทธิ์
 *   2) หน้า/action ที่กำหนดไว้ว่าต้อง owner หรือ editor ต้องใช้ระดับนั้นจริง
 *   3) ห้ามมี action ที่แตะข้อมูล family แต่ใช้แค่ authAction (ล็อกอินก็พอ)
 *
 * รันอัตโนมัติผ่าน `npm run lint`
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// ใช้ fileURLToPath ไม่ใช่ .pathname — ไม่งั้น path ที่มีวงเล็บหรือช่องว่างจะถูก percent-encode
const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const fail = [];

/** ระดับสิทธิ์ขั้นต่ำที่แต่ละหน้าต้องบังคับ — ที่มา: architecture.md §2 */
const PAGE_RULES = {
  "family/invite": "owner",
  "profile/pregnancy": "owner",
  "health/new": "editor",
  "health/[id]/edit": "editor",
  "appointments/new": "editor",
  "appointments/[id]/edit": "editor",
  "album/upload": "editor",
};
/** หน้าที่แก้ข้อมูลของตัวเอง ไม่ผูกกับ family จึงใช้แค่ session */
const SESSION_ONLY_PAGES = new Set(["profile/edit"]);

/** action ที่ต้องใช้ client ระดับไหน */
const ACTION_RULES = {
  "family.ts": ["ownerAction", "memberAction", "authAction"],
  "invites.ts": ["ownerAction", "authAction"],
  "pregnancy.ts": ["ownerAction"],
  "weekly-logs.ts": ["editorAction", "memberAction"],
  "appointments.ts": ["editorAction"],
  "onboarding.ts": ["authAction"],
  "profile.ts": ["authAction"],
  "photos.ts": ["editorAction"],
};

function walk(dir) {
  const out = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

// 1) ทุกหน้าในโซนแอปต้องมีด่าน
const appDir = join(ROOT, "src/app/(app)");
for (const f of walk(appDir).filter((p) => p.endsWith("page.tsx"))) {
  const rel = f.slice(appDir.length + 1).replace("/page.tsx", "");
  const src = readFileSync(f, "utf8");
  const m = src.match(/requireFamilyContext\("(\w+)"\)/);

  if (!m) {
    if (!SESSION_ONLY_PAGES.has(rel)) {
      fail.push(`หน้า /${rel} ไม่มีด่านตรวจสิทธิ์ (requireFamilyContext)`);
    } else if (!src.includes("getSessionUser")) {
      fail.push(`หน้า /${rel} ไม่ได้เช็ค session เลย`);
    }
    continue;
  }
  const expected = PAGE_RULES[rel] ?? "viewer";
  if (m[1] !== expected) {
    fail.push(`หน้า /${rel} ใช้ requireFamilyContext("${m[1]}") แต่ควรเป็น "${expected}"`);
  }
}

// 2) action ต้องใช้ client ตามที่กำหนด
const actionsDir = join(ROOT, "src/actions");
for (const f of readdirSync(actionsDir).filter((n) => n.endsWith(".ts"))) {
  const src = readFileSync(join(actionsDir, f), "utf8");
  const allowed = ACTION_RULES[f];
  if (!allowed) {
    fail.push(`มีไฟล์ action ใหม่ ${f} ที่ยังไม่ได้ประกาศกฎใน scripts/check-authz.mjs`);
    continue;
  }
  for (const used of src.matchAll(/^export const \w+ = (\w+Action)/gm)) {
    if (!allowed.includes(used[1])) {
      fail.push(`${f} ใช้ ${used[1]} ซึ่งไม่อยู่ในกฎ [${allowed.join(", ")}]`);
    }
  }
}

// 3) ทุก action ที่แตะข้อมูล family ต้องกรอง familyId ด้วยเสมอ
for (const f of readdirSync(actionsDir).filter((n) => n.endsWith(".ts"))) {
  const src = readFileSync(join(actionsDir, f), "utf8");
  for (const stmt of src.matchAll(/ctx\.db\s*\n?\s*\.(update|delete)\(([^)]+)\)/g)) {
    const after = src.slice(stmt.index, stmt.index + 700);
    if (!after.includes("familyId") && !after.includes("user.id")) {
      fail.push(`${f}: ${stmt[1]}(${stmt[2].trim()}) ไม่ได้กรองด้วย familyId หรือ user.id`);
    }
  }
}

if (fail.length) {
  console.error("❌ ตรวจสิทธิ์ไม่ผ่าน:\n" + fail.map((f) => "   - " + f).join("\n"));
  process.exit(1);
}
console.log("✅ authz check ผ่าน — โค้ดตรงกับ permission matrix");
