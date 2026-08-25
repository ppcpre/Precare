#!/usr/bin/env bash
# สร้าง GitHub Issues จาก docs/project-plan.md
# generate โดย scripts/gen-issues.py — อย่าแก้ไฟล์นี้มือ ให้แก้ project-plan.md แล้ว regenerate
#
# ใช้งาน:  brew install gh && gh auth login && ./scripts/create-issues.sh

set -euo pipefail
REPO="ppcpre/Precare"

command -v gh >/dev/null || { echo "❌ ยังไม่ได้ติดตั้ง gh — brew install gh"; exit 1; }
gh auth status >/dev/null 2>&1 || { echo "❌ ยังไม่ได้ล็อกอิน — gh auth login"; exit 1; }

echo "==> สร้าง label"
gh label create M0 --repo "$REPO" --color 0E4B99 --description 'Foundation + Deploy (3–4 วัน)' --force >/dev/null
gh label create M1 --repo "$REPO" --color 1D76DB --description 'Database + Data layer (3–4 วัน)' --force >/dev/null
gh label create M2 --repo "$REPO" --color 5319E7 --description 'Auth (2–3 วัน)' --force >/dev/null
gh label create M3 --repo "$REPO" --color B60205 --description 'API layer (5–6 วัน)' --force >/dev/null
gh label create M4 --repo "$REPO" --color D93F0B --description 'Design หน้าจอ (5–7 วัน)' --force >/dev/null
gh label create M5 --repo "$REPO" --color 0E8A16 --description 'UI implementation (9–11 วัน)' --force >/dev/null
gh label create M6 --repo "$REPO" --color 6B4F3F --description 'Test + Go live (3–4 วัน)' --force >/dev/null
gh label create blocked --repo "$REPO" --color BFBFBF --description "รอ task อื่นก่อน" --force >/dev/null

echo "==> เช็ค issue เดิม (กันสร้างซ้ำ)"
EXISTING=$(gh issue list --repo "$REPO" --state all --limit 500 --json title --jq '.[].title' || true)

create() {  # $1=title  $2=body  $3=labels
  if grep -Fxq "$1" <<< "$EXISTING"; then echo "  ข้าม (มีแล้ว): $1"; return; fi
  gh issue create --repo "$REPO" --title "$1" --body "$2" --label "$3" >/dev/null
  echo "  สร้าง: $1"
}

create 'T0.2 อัปเดต `architecture.md` ตามหัวข้อ 1' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** เอกสารเขียน Workers + OpenNext + Better Auth ตรงกับที่จะทำจริง

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0
create 'T0.3 ล้าง scaffold ใน zip' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** ลบ `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc`, `firestore.indexes.json`, `src/lib/firebase.ts` · ถอด `firebase` ออกจาก `package.json` · เก็บ `src/lib/pregnancy.ts` ไว้ทั้งไฟล์
**ขึ้นกับ:** T0.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T0.4 ติดตั้ง `@opennextjs/cloudflare` + `wrangler`' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** `wrangler.jsonc` + `open-next.config.ts` มีอยู่, `npm run build` ผ่าน
**ขึ้นกับ:** T0.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T0.5 deploy ครั้งแรกขึ้น workers.dev' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** เปิด `https://xxx.workers.dev` แล้วเห็นหน้า Next.js · ยืนยันว่า bundle < 3 MiB
**ขึ้นกับ:** T0.4

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T0.6 สร้าง D1 + binding' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** `wrangler d1 create` เสร็จ, `env.DB` เรียกได้จาก route handler
**ขึ้นกับ:** T0.4

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T0.7 GitHub Actions CI/CD' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** PR → preview URL · merge `main` → production deploy อัตโนมัติ
**ขึ้นกับ:** T0.5

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T0.8 Tailwind v4 + design tokens' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** สี brown/cream/ink จาก `design-system.md` ครบทุก token · โหลด Noto Sans Thai · radius sm/md/lg · shadow-card
**ขึ้นกับ:** T0.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T0.9 โครง layout + routing เปล่า' '**Milestone M0 — Foundation + Deploy**

**เสร็จเมื่อ (DoD):** 15 routes มีไฟล์ครบ ยังเป็นหน้าเปล่า · BottomNav + Sidebar สลับตาม breakpoint ได้
**ขึ้นกับ:** T0.8

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M0,blocked
create 'T1.1 แก้ DDL ให้ครบ' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** เพิ่ม `appointments.location`, `users.avatar_url` · ตัด `password_hash` (Better Auth เก็บใน `account` เอง) · คง `users.email UNIQUE NOT NULL` เป็น identifier · ตัด `baby_*` ไป Phase 3 · เตรียมตาราง `photos` (id, family_id, week, type, r2_key, thumb_key, caption, uploaded_by, created_at) ไว้ใน migration แต่ยังไม่ใช้จน Phase 2
**ขึ้นกับ:** T0.6

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T1.2 เขียน migration files' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** `migrations/0001_init.sql` · apply ผ่านทั้ง `--local` และ `--remote`
**ขึ้นกับ:** T1.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T1.3 ตั้ง Drizzle schema' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** `src/db/schema.ts` ตรงกับ DDL · `drizzle-kit` generate ได้
**ขึ้นกับ:** T1.2

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T1.4 เขียน types ใหม่ทั้งไฟล์' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** `src/types/index.ts` เป็นโครง family-based ตรง D1 — ของเดิมใน zip เป็น per-user + Firebase ใช้ไม่ได้เลย
**ขึ้นกับ:** T1.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T1.5 authz helper' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** `requireRole(familyId, userId, minRole)` — คืน 403 เมื่อสิทธิ์ไม่พอ ตาม matrix ใน architecture.md
**ขึ้นกับ:** T1.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T1.7 ต่อ Cloudflare R2 *(ดึงมาจาก Phase 2)*' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** binding + presigned upload ผ่าน API layer — ห้าม expose credential ให้ client
**ขึ้นกับ:** T1.5

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T1.6 seed script สำหรับ dev' '**Milestone M1 — Database + Data layer**

**เสร็จเมื่อ (DoD):** 1 family, 3 users (owner/editor/viewer), 5 weekly_logs, 3 appointments
**ขึ้นกับ:** T1.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M1,blocked
create 'T2.1 ติดตั้ง Better Auth + Drizzle/D1 adapter' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** ตาราง auth ถูกสร้างใน D1 · `/api/auth/*` ตอบสนอง
**ขึ้นกับ:** T1.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T2.2 เปิด email + password' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** `emailAndPassword.enabled = true` · `requireEmailVerification = false` *(ชั่วคราว)* · ล็อกอินด้วยอีเมลเป็น identifier ไม่มี username แยก · สมัคร + ล็อกอินได้จริง
**ขึ้นกับ:** T2.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T2.3 Google OAuth' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** สร้าง OAuth client ใน Google Cloud Console · ใส่ redirect URI ทั้ง localhost, preview และ production · ล็อกอินด้วย Google ได้จริง
**ขึ้นกับ:** T2.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T2.4 session ยาว 60 วัน (decision #3)' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** `expiresIn: 60 วัน`, `updateAge: 1 วัน` · ปิดเบราว์เซอร์แล้วเปิดใหม่ยังล็อกอินอยู่
**ขึ้นกับ:** T2.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T2.5 Account linking' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** อีเมลเดียวกันสมัครด้วยรหัสผ่านแล้วมาล็อกอิน Google → เข้าบัญชีเดิม ไม่สร้างใหม่
**ขึ้นกับ:** T2.2, T2.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T2.6 middleware ป้องกัน route' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** ไม่มี session → `/login` · มี session แต่ไม่มี `active_family_id` → `/onboarding`
**ขึ้นกับ:** T2.4

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T2.7 rate limit การล็อกอิน' '**Milestone M2 — Auth**

**เสร็จเมื่อ (DoD):** ใส่ผิดเกิน N ครั้ง → หน่วงเวลา
**ขึ้นกับ:** T2.2

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M2,blocked
create 'T3.1 Family + membership' '**Milestone M3 — API layer**

**Endpoints:** `GET/PATCH /api/families/:id` · `GET /api/families/:id/members` · `PATCH`/`DELETE` member (owner) · `POST /api/families/:id/leave`
**ขึ้นกับ:** T1.5, T2.6

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.2 Invites' '**Milestone M3 — API layer**

**Endpoints:** `POST /api/families/:id/invites` (owner) · `GET/POST /api/invites/:token/accept` · `DELETE` ยกเลิก · logic หมดอายุ 7 วัน + ใช้ครั้งเดียว
**ขึ้นกับ:** T3.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.3 Onboarding' '**Milestone M3 — API layer**

**Endpoints:** `POST /api/onboarding` — สร้าง family + `family_members(owner)` + `pregnancy_profiles` + set `active_family_id` แบบ transaction เดียว
**ขึ้นกับ:** T3.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.4 Pregnancy profile' '**Milestone M3 — API layer**

**Endpoints:** `GET/PUT /api/families/:id/pregnancy` — owner เท่านั้นที่แก้ได้
**ขึ้นกับ:** T3.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.5 Weekly logs CRUD' '**Milestone M3 — API layer**

**Endpoints:** `GET/POST /api/families/:id/logs` · `GET/PATCH/DELETE /api/logs/:id` · `symptoms` parse/stringify JSON ที่ชั้นนี้
**ขึ้นกับ:** T3.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.6 Appointments CRUD' '**Milestone M3 — API layer**

**Endpoints:** `GET/POST /api/families/:id/appointments` · `GET/PATCH/DELETE /api/appointments/:id`
**ขึ้นกับ:** T3.1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.7 Dashboard aggregate' '**Milestone M3 — API layer**

**Endpoints:** `GET /api/families/:id/dashboard` — อายุครรภ์ + นัดถัดไป + logs ล่าสุด ใน request เดียว (ลด round-trip บนมือถือ)
**ขึ้นกับ:** T3.4–T3.6

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T3.8 Authorization test' '**Milestone M3 — API layer**

**Endpoints:** Vitest: viewer เขียนไม่ได้ · editor แก้ pregnancy ไม่ได้ · คนนอก family เข้าไม่ได้เลย — ครบทุก endpoint
**ขึ้นกับ:** T3.1–T3.7

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M3,blocked
create 'T4.1 Component library' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** Button (4 variants × 5 states), Card, Input, Badge, BottomNav, Toast, EmptyState

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.2 Dashboard' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** default + ยังไม่ตั้ง LMP + เลยกำหนดคลอด + viewer variant

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.3 Health list + form' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** list + empty + form (มี MoodPicker, ChipMultiSelect, BPInput)

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.4 Appointments list + form' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** list + empty + form + banner ขอสิทธิ์ notification

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.5 Family + invite' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** member list 3 roles + invite sheet 2 ขั้น + non-owner variant

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.6 Auth + Onboarding' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** `/login` (Google + อีเมล/รหัสผ่าน + ข้อความลืมรหัสผ่าน), `/signup`, `/invite/[token]`, onboarding 4 ขั้น

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.0 โลโก้ Pre Care' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** เลือกแบบ C แล้ว · spec sheet ครบ (clear space, ขนาด 20–96px, ขาวดำ, favicon/app icon, ข้อห้าม) · เหลือ export SVG + PNG ตอน dev

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T4.7 เก็บตก' '**Milestone M4 — Design หน้าจอ**

**เสร็จเมื่อ (DoD):** error/loading states + `/profile/pregnancy` + นัดหมาย empty state

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M4
create 'T5.1 Component library เป็นโค้ดจริง' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.1, T0.8

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.2 หน้า Auth (`/login`, `/signup`)' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.6, T2.2, T2.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.3 Onboarding 4 ขั้น + คำนวณ LMP↔EDD' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.6, T3.3

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.4 Dashboard + hero + progress bar' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.2, T3.7

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.5 Health list + form' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.3, T3.5

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.6 Appointments list + form' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.4, T3.6

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.7 Family + invite + copy link' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.5, T3.2

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.8 Profile + pregnancy settings' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T4.7, T3.4

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.9 Role-based rendering ทั้งแอป — viewer ต้องไม่เห็นปุ่มเลย ไม่ใช่ disabled' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T5.4–T5.8

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.10 Browser Notification สำหรับนัดหมาย' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T5.6

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.11 Loading / empty / error states ครบทุกหน้า' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T5.4–T5.8

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T5.12 อัปโหลดรูปโปรไฟล์ — resize ฝั่ง client (ด้านยาว ≤ 1600px) → R2 → `users.avatar_url`' '**Milestone M5 — UI implementation**

**ขึ้นกับ:** T1.7, T5.8

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M5,blocked
create 'T6.1 Unit test' '**Milestone M6 — Test + Go live**

**เสร็จเมื่อ (DoD):** `lib/pregnancy.ts` (มีอยู่แล้ว เขียน test ได้เลย) + query builders

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M6
create 'T6.2 Integration test' '**Milestone M6 — Test + Go live**

**เสร็จเมื่อ (DoD):** API routes ผ่าน `wrangler dev` + local D1

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M6
create 'T6.3 E2E (Playwright)' '**Milestone M6 — Test + Go live**

**เสร็จเมื่อ (DoD):** signup → onboarding → บันทึกสุขภาพ → นัดหมาย → เชิญสมาชิก → รับคำเชิญ ครบ 1 รอบ

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M6
create 'T6.4 ทดสอบบนมือถือจริง' '**Milestone M6 — Test + Go live**

**เสร็จเมื่อ (DoD):** iOS Safari + Android Chrome · touch target ≥ 44px · bottom nav ไม่ทับ safe area

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M6
create 'T6.5 Production hardening' '**Milestone M6 — Test + Go live**

**เสร็จเมื่อ (DoD):** error boundary, 404/500, security headers, rate limit

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M6
create 'T6.6 Go-live checklist' '**Milestone M6 — Test + Go live**

**เสร็จเมื่อ (DoD):** ตามหัวข้อ 5.5

อ้างอิง: [docs/project-plan.md](https://github.com/ppcpre/Precare/blob/main/docs/project-plan.md)' M6

echo
echo "✅ เสร็จ — ดูที่ https://github.com/$REPO/issues"
echo "   ขั้นถัดไป: สร้าง Project board แล้วลาก issue เข้าไป"
