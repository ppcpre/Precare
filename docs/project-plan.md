# Health Care — Project Plan & Task Breakdown (Phase 1)

> **ชื่อเรียก:** **Health Care** = ตัว web app · **Pre Care** = ฟีเจอร์บันทึกการตั้งครรภ์ ซึ่งเป็น 1 ในฟีเจอร์ และเป็นฟีเจอร์แรกที่ลงมือทำ — Phase 1 ส่งมอบ Pre Care ตัวเดียว บนโครง Health Care ที่รองรับฟีเจอร์เพิ่มได้

> **อัปเดต:** 25 ส.ค. 2569 · **อ้างอิง:** [tech-notes.md](./tech-notes.md) · [screen-blueprint.md](./screen-blueprint.md) · [architecture.md](./architecture.md) · [design-system.md](./design-system.md)

---

## 0. การตัดสินใจที่ล็อกแล้ว

| # | เรื่อง | สรุป |
|---|---|---|
| 1 | **Auth = Google OAuth + อีเมล/รหัสผ่าน** | ไม่มี OTP ใน Phase 1 |
| 1b | **อีเมลคือ username** | ล็อกอินด้วยอีเมล + รหัสผ่าน · **ไม่มีฟิลด์ username แยก** · `users.email` เป็น UNIQUE ใช้เป็น identifier เดียวของบัญชี — ตรงกับที่ Google OAuth คืนอีเมลมาพอดี ทำให้ account linking (T2.5) ทำงานได้ |
| 2 | **ยกงานอีเมลทั้งก้อนไป Phase 1.5** | Email OTP, ลืมรหัสผ่าน, อีเมลเชิญอัตโนมัติ, ยืนยันอีเมล — ทำพร้อมกันทีเดียวตอนมี email service |
| 3 | **จำ user ไว้** | session **60 วัน** + rolling refresh ทุกครั้งที่ใช้งาน → ปิดแท็บแล้วเปิดใหม่ยังล็อกอินอยู่ |
| 4 | **ไม่ทำ dark mode** | ตัดออกทั้งฝั่ง design และ code |
| 5 | **Cloudflare** (มีบัญชีแล้ว) | Workers + D1 · รันบน `*.workers.dev` ฟรี |
| 6 | **ชื่อผลิตภัณฑ์** | Health Care (web app) / Pre Care (ฟีเจอร์ตั้งครรภ์) |
| 7 | **Bottom nav** | `ครอบครัว` ย้ายเข้าโปรไฟล์ · เอา **`อัลบั้ม`** มาแทน — แต่อัลบั้มทำจริง **Phase 2** |
| 8 | **รูปภาพ** | **อัปโหลดรูปโปรไฟล์ = Phase 1** (ดึงขึ้นมาตามที่สั่ง) · แนบรูปในบันทึก + อัลบั้ม = Phase 2 · ปุ่มแชร์ social = Phase 3 |
| 9 | **โลโก้** | ✅ **เลือกแบบ C (หน่ออ่อน)** แล้ว — ใส่ลงทุกหน้าจอเรียบร้อย เหลือเลือกสีใบ เขียว/ส้ม |
| 11 | **ภาพเทียบขนาด 37 ภาพ** | **ไม่วาดเอง** — ชี้ไปที่ R2 ด้วย path คงที่ `weekly/size/w04..w40.webp` หย่อนไฟล์ทีหลังได้โดยไม่ต้อง deploy · ไม่มีไฟล์ = fallback แสดงเลขสัปดาห์ ([รายละเอียด](./tech-notes.md)) |
| 10 | **เนื้อหารายสัปดาห์** | การ์ด "ขนาดของลูกน้อย" + "พัฒนาการของหนูน้อย" — **Phase 2** · ข้อมูล 37 สัปดาห์รวบรวมแล้วใน [pregnancy-weekly-data.md](./pregnancy-weekly-data.md) |

### สิ่งที่ได้จากการเลื่อนงานอีเมล

**Phase 1 ไม่ต้องพึ่งบริการภายนอกเลยสักตัว** — ไม่ต้องซื้อ domain, ไม่ต้องสมัคร Resend, ไม่ต้อง verify DNS อะไรทั้งนั้น ทุกอย่างอยู่ในบัญชี Cloudflare ที่มีอยู่แล้ว + Google Cloud Console (ฟรี) เท่านั้น

| | ก่อนหน้า (แผน OTP) | ตอนนี้ |
|---|---|---|
| บริการนอกที่ต้องต่อ | Resend + domain + DNS verify | **ไม่มี** |
| ค่าใช้จ่ายเริ่มต้น | ~$10/ปี (domain) | **$0** |
| งาน auth | ~4–5 วัน | **~2–3 วัน** |
| คนอื่นเข้ามาใช้ได้ไหม | เฉพาะ Google | **ได้ทั้ง Google และสมัครด้วยอีเมล** ✅ |

### ⚠️ ช่องโหว่ที่ต้องยอมรับใน Phase 1

**ไม่มีปุ่ม "ลืมรหัสผ่าน"** — เพราะการรีเซ็ตรหัสผ่านต้องส่งอีเมล ซึ่งเรายังไม่มี

**ทางแก้ที่ต้องออกแบบไว้ในหน้า login:** ข้อความใต้ฟอร์ม — *"ลืมรหัสผ่าน? ตอนนี้ยังรีเซ็ตเองไม่ได้ ถ้าอีเมลของคุณเป็น Gmail ให้กดเข้าสู่ระบบด้วย Google ด้านบนได้เลย ระบบจะเชื่อมเข้าบัญชีเดิมให้อัตโนมัติ"* — Better Auth ทำ account linking ให้เมื่ออีเมลตรงกัน จึงใช้เป็นทางออกฉุกเฉินได้จริง

**ผลพ่วง 2 ข้อ:**
- ตั้ง `requireEmailVerification: false` — อีเมลที่สมัครเข้ามาจะยังไม่ผ่านการยืนยัน ยอมรับได้ในช่วงทดลอง แต่ต้องกลับมาเปิดใน Phase 1.5
- การเชิญสมาชิกใช้ **copy link** ส่งเองทาง LINE — ซึ่ง blueprint ออกแบบไว้แบบนี้อยู่แล้ว ไม่กระทบ

---

## 1. Stack ที่ต้องเปลี่ยนจาก architecture.md

เอกสารเดิมมี 2 จุดที่ล้าสมัยแล้ว ต้องแก้ก่อนเริ่มเขียนโค้ด

### 1.1 Cloudflare Pages → **Cloudflare Workers + OpenNext**

`@cloudflare/next-on-pages` ที่เอกสารเดิมอ้างถึง **ถูก deprecate แล้ว** — Cloudflare ประกาศให้ใช้ `@opennextjs/cloudflare` แทน และ deploy ลง **Workers ไม่ใช่ Pages**

| | เดิมในเอกสาร | ที่จะใช้จริง |
|---|---|---|
| Adapter | `@cloudflare/next-on-pages` *(deprecated)* | `@opennextjs/cloudflare` (GA ก.พ. 2569) |
| Deploy target | Cloudflare Pages | **Cloudflare Workers** |
| Runtime | Edge runtime | **Node.js runtime** — รองรับ Next.js ได้ครบกว่ามาก |
| Next.js | — | รองรับ Next.js 16 ทุก minor/patch ✅ *(zip ใช้ 16.3.2 พอดี)* |
| API layer | Pages Functions `/functions/*` | Next.js Route Handlers `app/api/*` ตามปกติ |

**ข้อดีที่ได้มาฟรี:** ไม่ต้องเขียน Pages Functions แยกอีกแล้ว — API เป็น Route Handler ใน Next.js ปกติ เข้าถึง D1 ผ่าน `getCloudflareContext().env.DB` โครงสร้างโปรเจกต์เรียบง่ายกว่าแผนเดิมมาก

### 1.2 Auth.js → **Better Auth**

| | Auth.js (แผนเดิม) | Better Auth |
|---|---|---|
| อีเมล/รหัสผ่าน | ต้อง implement Credentials provider + hashing เอง | `emailAndPassword: { enabled: true }` — มี scrypt ในตัว รันบน Workers ได้ |
| Google OAuth | ✅ | ✅ |
| D1 | `@auth/d1-adapter` — ไม่ใช่ของ Cloudflare, มี issue เรื่องเอกสารค้าง | รองรับ first-class ผ่าน Drizzle adapter |
| session ยาว (decision #3) | ตั้งเองได้ | `session.expiresIn` + `updateAge` แบบ rolling |
| **ทางไป Phase 1.5** | ต้องเขียน OTP flow เองทั้งหมด | **เพิ่ม `emailOTP` plugin บรรทัดเดียว** — รหัส 6 หลัก, หมดอายุ, จำกัดจำนวนครั้ง, สร้าง user อัตโนมัติ มาให้ครบ |

> เหตุผลหลักที่เลือก Better Auth คือแถวสุดท้าย — พอถึง Phase 1.5 การเพิ่ม Email OTP เป็นการ**ติด plugin** ไม่ใช่การเขียนใหม่

**งานที่ต้องทำ:** อัปเดต `architecture.md` หัวข้อ 0 และ 2 ให้ตรงกับ 1.1 + 1.2 — ไม่งั้นเอกสารจะพาหลงทาง (งาน **T0.2**)

---

## 2. Free Tier — ตัวเลขจริง

| บริการ | Free tier | จุดที่ต้องระวัง |
|---|---|---|
| **Workers** | 100,000 requests/วัน · CPU 10ms/invocation | ⚠️ **bundle limit 3 MiB (gzip)** — Next.js โตเกินได้ง่าย · Paid $5/เดือน ขยายเป็น 10 MiB |
| **D1** | 5 GB · อ่าน 5M rows/วัน · เขียน 100K rows/วัน | เหลือเฟือสำหรับ Phase 1 |
| **workers.dev** | ฟรีถาวร ได้ `xxx.workers.dev` | ใช้เป็น URL จริงได้เลย |
| **Google OAuth** | ฟรี ไม่จำกัด | ใช้ได้บน workers.dev ไม่ต้องมี domain |
| **R2** | 10 GB-month | ยังไม่ใช้ใน Phase 1 |

**ความเสี่ยงเดียวที่ต้องจับตา:** bundle 3 MiB — เจอตั้งแต่ **T0.5** (deploy ครั้งแรก) ไม่ใช่ตอนท้ายโปรเจกต์ ถ้าเกินจริงทางแก้คือจ่าย $5/เดือน

---

## 3. Milestones

```
M0  Foundation + Deploy    ███░░░░░░░   3–4 วัน   ← ขึ้นเว็บจริงตั้งแต่ milestone แรก
M1  Database + Data layer  ███░░░░░░░   3–4 วัน
M2  Auth                   ██░░░░░░░░   2–3 วัน
M3  API layer              █████░░░░░   5–6 วัน
M4  Design หน้าจอ          █████░░░░░   5–7 วัน   ← ทำขนานกับ M1–M3 ได้
M5  UI implementation      █████████░   9–11 วัน   ← +1 วัน (อัปโหลดรูปโปรไฟล์)
M6  Test + Go live         ███░░░░░░░   3–4 วัน
                                       ──────────
                            รวม ~26–32 วันทำงาน (solo)
```

**เส้นทางวิกฤต:** M0 → M1 → M2 → M3 → M5 → M6
**M4 (design) ไม่บล็อกอะไรจนถึง M5** ทำขนานไปกับงาน backend ได้ → ถ้าทำขนานจริงจบราว **21–26 วัน**

---

## 4. Task Breakdown

### M0 · Foundation + Deploy — 3–4 วัน

> เป้าหมาย: **มี URL จริงที่เปิดได้ตั้งแต่วันแรก** พร้อม CI ที่ deploy อัตโนมัติ ไม่ปล่อยให้ deploy เป็นงานตอนท้าย
>
> **สถานะ 25 ส.ค. 69 — เสร็จ 8/9** เหลือ **T0.5** ที่ deploy ผ่านแล้วทั้ง dev และ production
> แต่ URL ยังเข้าไม่ได้เพราะต้องเปิด workers.dev subdomain ในหน้า Cloudflare dashboard (CLI ทำไม่ได้)
>
> **ตัวเลขที่วัดได้จริง:** bundle gzip **1,034 KiB = 33% ของเพดาน 3 MiB** · worker startup **43 ms**

| ID | งาน | เสร็จเมื่อ (DoD) | ขึ้นกับ |
|---|---|---|---|
| ✅ **T0.1** | `git init` + push ขึ้น GitHub | repo มี commit แรก, branch `main` | — |
| ✅ **T0.2** | อัปเดต `architecture.md` ตามหัวข้อ 1 | เอกสารเขียน Workers + OpenNext + Better Auth ตรงกับที่จะทำจริง | — |
| ✅ **T0.3** | ล้าง scaffold ใน zip | ลบ `firestore.rules`, `storage.rules`, `firebase.json`, `.firebaserc`, `firestore.indexes.json`, `src/lib/firebase.ts` · ถอด `firebase` ออกจาก `package.json` · เก็บ `src/lib/pregnancy.ts` ไว้ทั้งไฟล์ | T0.1 |
| ✅ **T0.4** | ติดตั้ง `@opennextjs/cloudflare` + `wrangler` | `wrangler.jsonc` + `open-next.config.ts` มีอยู่, `npm run build` ผ่าน | T0.3 |
| ✅ **T0.5** | **deploy ครั้งแรกขึ้น workers.dev** | เปิด `https://xxx.workers.dev` แล้วเห็นหน้า Next.js · **ยืนยันว่า bundle < 3 MiB** | T0.4 |
| ✅ **T0.6** | สร้าง D1 + binding | `wrangler d1 create` เสร็จ, `env.DB` เรียกได้จาก route handler | T0.4 |
| ✅ **T0.7** | GitHub Actions CI/CD + **แยก env dev** | สร้าง `precare-dev-db` + `env.dev` ใน `wrangler.jsonc` · PR → preview URL (ผูก D1 ของ dev) · push `dev` → deploy `precare-dev` · merge `main` → production deploy อัตโนมัติ | T0.5 |
| ✅ **T0.8** | Tailwind v4 + design tokens | สี brown/cream/ink จาก `design-system.md` ครบทุก token · โหลด Noto Sans Thai · radius sm/md/lg · shadow-card | T0.3 |
| ✅ **T0.9** | โครง layout + routing เปล่า | 15 routes มีไฟล์ครบ ยังเป็นหน้าเปล่า · BottomNav + Sidebar สลับตาม breakpoint ได้ | T0.8 |

### M1 · Database + Data layer — 3–4 วัน

> **สถานะ 25 ส.ค. 69 — เสร็จ 6/7** · T1.7 (R2) เลื่อนไปทำพร้อม M2 เพราะยังไม่มีอะไรเรียกใช้
> migration ยิงขึ้น `precare-dev-db` แล้ว 12 ตาราง · seed ข้อมูลตัวอย่างครบ
> **bundle ยังเท่าเดิม 1,034 KiB** — drizzle/better-auth ถูก tree-shake ออกเพราะยังไม่มีหน้าไหน import

| ID | งาน | เสร็จเมื่อ (DoD) | ขึ้นกับ |
|---|---|---|---|
| ✅ **T1.1** | แก้ DDL ให้ครบ | เพิ่ม `appointments.location`, `users.avatar_url` · ตัด `password_hash` (Better Auth เก็บใน `account` เอง) · คง `users.email UNIQUE NOT NULL` เป็น identifier · ตัด `baby_*` ไป Phase 3 · **เตรียมตาราง `photos` (id, family_id, week, type, r2_key, thumb_key, caption, uploaded_by, created_at) ไว้ใน migration แต่ยังไม่ใช้จน Phase 2** | T0.6 |
| ✅ **T1.2** | เขียน migration files | `migrations/0001_init.sql` · apply ผ่านทั้ง `--local` และ `--remote` | T1.1 |
| ✅ **T1.3** | ตั้ง Drizzle schema | `src/db/schema.ts` ตรงกับ DDL · `drizzle-kit` generate ได้ | T1.2 |
| ✅ **T1.4** | เขียน types ใหม่ทั้งไฟล์ | `src/types/index.ts` เป็นโครง family-based ตรง D1 — **ของเดิมใน zip เป็น per-user + Firebase ใช้ไม่ได้เลย** | T1.3 |
| ✅ **T1.5** | **authz helper** | `requireRole(familyId, userId, minRole)` — คืน 403 เมื่อสิทธิ์ไม่พอ ตาม matrix ใน architecture.md | T1.3 |
| ⏭ **T1.7** | **ต่อ Cloudflare R2** *(ดึงมาจาก Phase 2)* | binding + presigned upload ผ่าน API layer — ห้าม expose credential ให้ client | T1.5 |
| ✅ **T1.6** | seed script สำหรับ dev | 1 family, 3 users (owner/editor/viewer), 5 weekly_logs, 3 appointments | T1.3 |

### M2 · Auth — 2–3 วัน

> **สถานะ 25 ส.ค. 69 — เสร็จ 7/7** ทดสอบบน dev worker จริงแล้ว
>
> **ความเสี่ยงข้อใหญ่ปิดแล้ว** — scrypt ของ Better Auth ทำงานได้บน free plan ที่จำกัด CPU 10 ms
> ทั้ง sign-up และ sign-in ผ่าน · รหัสผิดตอบ 401 ถูกต้อง · **ไม่ต้องขึ้น Workers Paid**
>
> **✅ Google OAuth เสียบแล้ว (26 ส.ค. 69)** — ทดสอบบน dev worker จริง endpoint คืน Google auth URL
> ที่มี redirect_uri ตรงกับ dev, scope `email profile openid`, PKCE S256 ครบ
> `GOOGLE_CLIENT_ID` อยู่ใน `wrangler.jsonc` (ค่าสาธารณะโดยการออกแบบ) · `GOOGLE_CLIENT_SECRET` เป็น secret บน worker
>
> **bundle 1,650 KiB = 54% ของเพดาน 3 MiB** (จาก 1,034 KiB ตอนจบ M1) — Better Auth + Drizzle + middleware กินไปราว 600 KiB

| ID | งาน | เสร็จเมื่อ (DoD) | ขึ้นกับ |
|---|---|---|---|
| ✅ **T2.1** | ติดตั้ง Better Auth + Drizzle/D1 adapter | ตาราง auth ถูกสร้างใน D1 · `/api/auth/*` ตอบสนอง | T1.3 |
| ✅ **T2.2** | เปิด email + password | `emailAndPassword.enabled = true` · `requireEmailVerification = false` *(ชั่วคราว)* · **ล็อกอินด้วยอีเมลเป็น identifier ไม่มี username แยก** · สมัคร + ล็อกอินได้จริง | T2.1 |
| ✅ **T2.3** | Google OAuth | สร้าง OAuth client ใน Google Cloud Console · ใส่ redirect URI **ทั้ง localhost, preview และ production** · ล็อกอินด้วย Google ได้จริง | T2.1 |
| ✅ **T2.4** | **session ยาว 60 วัน** (decision #3) | `expiresIn: 60 วัน`, `updateAge: 1 วัน` · ปิดเบราว์เซอร์แล้วเปิดใหม่ยังล็อกอินอยู่ | T2.1 |
| ✅ **T2.5** | Account linking | อีเมลเดียวกันสมัครด้วยรหัสผ่านแล้วมาล็อกอิน Google → เข้าบัญชีเดิม ไม่สร้างใหม่ | T2.2, T2.3 |
| ✅ **T2.6** | middleware ป้องกัน route | ไม่มี session → `/login` · มี session แต่ไม่มี `active_family_id` → `/onboarding` | T2.4 |
| ✅ **T2.7** | rate limit การล็อกอิน | ใส่ผิดเกิน N ครั้ง → หน่วงเวลา | T2.2 |

### M3 · API layer — 5–6 วัน

> **สถานะ 26 ส.ค. 69 — เสร็จ 8/8**
>
> ทำเป็น **Server Actions + next-safe-action** ตาม tech-notes แทนการเขียน REST เอง
> authz เป็น middleware chain 2 ชั้น: `authAction` → `memberAction`/`editorAction`/`ownerAction`
> **familyId มาจาก session เท่านั้น ไม่รับจาก client** ป้องกันการยิงข้าม family
>
> **T3.8 — 14 เทสต์ผ่านทั้งหมด** รันใน workerd จริงกับ D1 จริง ไม่ใช่ mock
> **bundle ยังคงที่ 1,650 KiB (54%)** — ไม่ขยับจากตอนจบ M2

> ทุก endpoint ต้องผ่าน 2 ขั้นเสมอ: **verify session → เช็ค role** ก่อนแตะ D1 เพราะ D1 ไม่มี row-level security

| ID | งาน | Endpoints | ขึ้นกับ |
|---|---|---|---|
| ✅ **T3.1** | Family + membership | `GET/PATCH /api/families/:id` · `GET /api/families/:id/members` · `PATCH`/`DELETE` member (owner) · `POST /api/families/:id/leave` | T1.5, T2.6 |
| ✅ **T3.2** | Invites | `POST /api/families/:id/invites` (owner) · `GET/POST /api/invites/:token/accept` · `DELETE` ยกเลิก · logic หมดอายุ 7 วัน + ใช้ครั้งเดียว | T3.1 |
| ✅ **T3.3** | Onboarding | `POST /api/onboarding` — สร้าง family + `family_members(owner)` + `pregnancy_profiles` + set `active_family_id` แบบ transaction เดียว | T3.1 |
| ✅ **T3.4** | Pregnancy profile | `GET/PUT /api/families/:id/pregnancy` — **owner เท่านั้นที่แก้ได้** | T3.1 |
| ✅ **T3.5** | Weekly logs CRUD | `GET/POST /api/families/:id/logs` · `GET/PATCH/DELETE /api/logs/:id` · `symptoms` parse/stringify JSON ที่ชั้นนี้ | T3.1 |
| ✅ **T3.6** | Appointments CRUD | `GET/POST /api/families/:id/appointments` · `GET/PATCH/DELETE /api/appointments/:id` | T3.1 |
| ✅ **T3.7** | Dashboard aggregate | `GET /api/families/:id/dashboard` — อายุครรภ์ + นัดถัดไป + logs ล่าสุด **ใน request เดียว** (ลด round-trip บนมือถือ) | T3.4–T3.6 |
| ✅ **T3.8** | **Authorization test** | Vitest: viewer เขียนไม่ได้ · editor แก้ pregnancy ไม่ได้ · คนนอก family เข้าไม่ได้เลย — **ครบทุก endpoint** | T3.1–T3.7 |

### M4 · Design หน้าจอ — 5–7 วัน *(ขนานกับ M1–M3)*

ลำดับตาม `screen-blueprint.md` หัวข้อ 12 — ปรับตามการตัดสินใจใหม่แล้ว

| ID | งาน | เสร็จเมื่อ (DoD) |
|---|---|---|
| **T4.1** | Component library | Button (4 variants × 5 states), Card, Input, Badge, BottomNav, Toast, EmptyState |
| **T4.2** | Dashboard | default + ยังไม่ตั้ง LMP + เลยกำหนดคลอด + **viewer variant** |
| **T4.3** | Health list + form | list + empty + form (มี MoodPicker, ChipMultiSelect, BPInput) |
| **T4.4** | Appointments list + form | list + empty + form + banner ขอสิทธิ์ notification |
| **T4.5** | Family + invite | member list 3 roles + invite sheet 2 ขั้น + **non-owner variant** |
| **T4.6** | Auth + Onboarding | `/login` (Google + อีเมล/รหัสผ่าน + ข้อความลืมรหัสผ่าน), `/signup`, `/invite/[token]`, onboarding 4 ขั้น |
| ✅ **T4.0** | **โลโก้ Pre Care** | เลือกแบบ C แล้ว · spec sheet ครบ (clear space, ขนาด 20–96px, ขาวดำ, favicon/app icon, ข้อห้าม) · เหลือ export SVG + PNG ตอน dev |
| **T4.7** | เก็บตก | error/loading states + `/profile/pregnancy` + นัดหมาย empty state |
| ✅ | **ทำไปแล้ว** | 20 หน้าจอ + component library — รวมโปรไฟล์อัปโหลดรูป, อัลบั้ม และหน้าดูรูป (Phase 2) ที่วาดล่วงหน้าไว้ |

### M5 · UI implementation — 9–11 วัน

> **สถานะ 26 ส.ค. 69 — 5/12**
>
> **ไม่ใช้ shadcn/ui** ตามที่เคยแนะนำไว้ — เขียน component เองแทน
> เหตุผล: component ที่ต้องใช้ส่วนใหญ่ง่ายมาก (Button/Card/Field/Badge/Chip) ไม่ต้องพึ่ง Radix
> และเหลือ budget bundle แค่ ~1.35 MiB · ผลคือ T5.1+T5.2 ทั้งก้อนเพิ่ม bundle แค่ **23 KiB**
> ถ้าถึงจุดที่ต้องใช้ Dialog/Select ที่ a11y ยาก ค่อยดึง Radix เฉพาะตัวนั้น
>
> **แนวโน้ม bundle (gzip / เพดาน 3,072 KiB)**
>
> | จุด | ขนาด | % | เพิ่ม |
> |---|---:|---:|---:|
> | จบ M3 | 1,650 | 54% | — |
> | T5.1+T5.2 | 1,673 | 54% | +23 |
> | T5.3 onboarding | 1,956 | 64% | **+283** |
> | T5.4 dashboard | 2,218 | 72% | **+262** |
> | *ลด bundle* | *1,630* | *53%* | *−588* |
> | T5.5 สุขภาพ | 1,820 | 59% | +190 |
>
> ตรวจแล้วว่า **ไม่ใช่** lucide (Next optimize ให้อยู่แล้ว ปรับ `optimizePackageImports` ไม่ขยับเลยสักไบต์)
> และ **ไม่ใช่** `next-safe-action/hooks` (ถอดออกแล้วประหยัดแค่ 1.76 KiB)
>
> **✅ แก้แล้ว — bundle ลดจาก 2,218 เหลือ 1,630 KiB (-588 KiB / -27%)** ดูหัวข้อ "การลด bundle" ด้านล่าง
>
> **⚠️ สมมติฐาน "ต้นทุนครั้งเดียว" ผิด** — T5.4 เพิ่มอีก 262 KiB แปลว่าโตเชิงเส้นราว 260 KiB ต่อกลุ่มหน้า
>
> **สาเหตุที่หาเจอ:** `better-auth` ถูก bundle ซ้ำทุก route ที่ import `getAuth()`
> ในไฟล์ worker ที่ bundle ออกมา `INVALID_EMAIL_OR_PASSWORD` โผล่ **16 ครั้ง** และ `getAuthTables` **24 ครั้ง**
> แถม `kysely` โผล่ **184 ครั้ง** ทั้งที่เราใช้ Drizzle ไม่ได้ใช้ Kysely เลย (Better Auth ลากมาเอง)
>
> **ลองแก้แล้วไม่ได้:** `serverExternalPackages: ["better-auth"]` ทำให้ OpenNext build พัง
> (`Could not resolve "@better-auth/core/instrumentation"`)
>
> **การลด bundle (26 ส.ค. 69)** — เลือกอยู่ free tier แล้วลดของ ไม่ขึ้น Workers Paid
>
> | สิ่งที่ทำ | ผล |
> |---|---:|
> | stub `kysely` + `@better-auth/kysely-adapter` ทิ้ง (better-auth ลาก adapter ทุกตัวมาแม้ใช้แค่ drizzle) | −107 KiB |
> | หน้าเว็บ + Server Action เลิก import `getAuth()` เปลี่ยนไปอ่าน session จาก D1 ตรง | −481 KiB |
> | **รวม** | **−588 KiB (−27%)** |
>
> ผลลัพธ์: **1,630 KiB = 53%** ต่ำกว่าตอนจบ M3 (1,650) ทั้งที่มี onboarding + dashboard เพิ่มมา
> `getAuthTables` เหลือ 9 ครั้ง (จาก 24) · `kysely` เหลือ 30 (จาก 184)
>
> **วิธีอ่าน session ใหม่:** cookie เก็บเป็น `<token>.<signature>` โดย token คือค่าสุ่ม 32 ตัวอักษร
> ที่อยู่ในตาราง `session` — ค้นเจอแถวที่ token ตรงและยังไม่หมดอายุ = ยืนยัน session ได้ในตัว
> **ข้อจำกัด:** ไม่ต่ออายุ session ให้ (better-auth ที่ `/api/auth/*` ยังทำหน้าที่นั้น) และไม่ตรวจ signature

| ID | งาน | ขึ้นกับ |
|---|---|---|
| ✅ **T5.1** | Component library เป็นโค้ดจริง | T4.1, T0.8 |
| ✅ **T5.2** | หน้า Auth (`/login`, `/signup`) | T4.6, T2.2, T2.3 |
| ✅ **T5.3** | Onboarding 4 ขั้น + คำนวณ LMP↔EDD | T4.6, T3.3 |
| ✅ **T5.4** | Dashboard + hero + progress bar | T4.2, T3.7 |
| ✅ **T5.5** | Health list + form | T4.3, T3.5 |
| **T5.6** | Appointments list + form | T4.4, T3.6 |
| **T5.7** | Family + invite + copy link | T4.5, T3.2 |
| **T5.8** | Profile + pregnancy settings | T4.7, T3.4 |
| **T5.9** | **Role-based rendering ทั้งแอป** — viewer ต้องไม่เห็นปุ่มเลย ไม่ใช่ disabled | T5.4–T5.8 |
| **T5.10** | Browser Notification สำหรับนัดหมาย | T5.6 |
| **T5.11** | Loading / empty / error states ครบทุกหน้า | T5.4–T5.8 |
| **T5.12** | **อัปโหลดรูปโปรไฟล์** — resize ฝั่ง client (ด้านยาว ≤ 1600px) → R2 → `users.avatar_url` | T1.7, T5.8 |

### M6 · Test + Go live — 3–4 วัน

| ID | งาน | เสร็จเมื่อ (DoD) |
|---|---|---|
| **T6.1** | Unit test | `lib/pregnancy.ts` (มีอยู่แล้ว เขียน test ได้เลย) + query builders |
| **T6.2** | Integration test | API routes ผ่าน `wrangler dev` + local D1 |
| **T6.3** | **E2E (Playwright)** | signup → onboarding → บันทึกสุขภาพ → นัดหมาย → เชิญสมาชิก → รับคำเชิญ ครบ 1 รอบ |
| **T6.4** | ทดสอบบนมือถือจริง | iOS Safari + Android Chrome · touch target ≥ 44px · bottom nav ไม่ทับ safe area |
| **T6.5** | Production hardening | error boundary, 404/500, security headers, rate limit |
| **T6.6** | Go-live checklist | ตามหัวข้อ 5.5 |

---

## 5. Deploy Plan

### 5.1 สี่สภาพแวดล้อม

| Env | Worker | ที่อยู่ | Database | Deploy เมื่อ |
|---|---|---|---|---|
| **Local** | — | `localhost:3000` | D1 local (`--local`) ในเครื่อง | `npm run dev` |
| **Preview** | `precare-dev` (version) | `<hash>-precare-dev.workers.dev` | `precare-dev-db` | เปิด PR |
| **Dev** | `precare-dev` | `precare-dev.<subdomain>.workers.dev` | `precare-dev-db` | push เข้า `dev` |
| **Production** | `precare` | `precare.<subdomain>.workers.dev` | `precare-db` | merge `dev` → `main` |

> **D1 ไม่มี branching แบบ Neon/PlanetScale** — จึงแยกเป็น DB คนละตัวไปเลย: `env.dev` ใน `wrangler.jsonc` ผูก `precare-dev-db` ส่วน top-level (production) ผูก `precare-db` ทั้ง PR preview และ dev deploy ยิงลง `precare-dev-db` เท่านั้น ไม่มีทางแตะข้อมูล production
>
> ⚠️ `d1_databases` / `vars` / `r2_buckets` เป็น **non-inheritable key** ของ wrangler — เพิ่ม binding ใหม่ต้องเพิ่มทั้งใน top-level และใน `env.dev` เสมอ ไม่งั้น dev จะขาด binding นั้นเงียบๆ · secret ก็แยกเช่นกัน (`wrangler secret put <NAME> --env dev`)

### 5.2 คำสั่งที่ใช้จริง

สร้าง D1 ครั้งแรก (ทำครั้งเดียว):

```bash
npx wrangler d1 create precare-db
```

สร้าง D1 ของ dev (ทำครั้งเดียว — เอา id ที่ได้ไปใส่ `env.dev` ใน `wrangler.jsonc`):

```bash
npx wrangler d1 create precare-dev-db
```

รัน migration — local:

```bash
npm run db:migrate:local
```

dev (remote):

```bash
npm run db:migrate:dev
```

production (remote):

```bash
npm run db:migrate:remote
```

ดูตัวอย่างจริงก่อน deploy (รันด้วย Workers runtime ในเครื่อง):

```bash
npx opennextjs-cloudflare build && npx opennextjs-cloudflare preview
```

deploy ขึ้น dev ด้วยมือ (ปกติปล่อยให้ CI ทำจาก branch `dev`):

```bash
npm run deploy:dev
```

deploy ขึ้น production:

```bash
npm run deploy
```

### 5.3 Secrets & Environment Variables

| ชื่อ | ประเภท | ได้มาจากไหน | ตั้งยังไง |
|---|---|---|---|
| `BETTER_AUTH_SECRET` | secret | สุ่ม 32 bytes (`openssl rand -base64 32`) | `wrangler secret put` |
| `BETTER_AUTH_URL` | var | URL ของแต่ละ env | `vars` ใน `wrangler.jsonc` |
| `GOOGLE_CLIENT_ID` | var | Google Cloud Console | `vars` |
| `GOOGLE_CLIENT_SECRET` | secret | Google Cloud Console | `wrangler secret put` |
| `DB` | binding | D1 ที่สร้างใน T0.6 | `d1_databases` ใน `wrangler.jsonc` |

**Secrets ฝั่ง GitHub Actions:** `CLOUDFLARE_API_TOKEN` (scope: Workers Scripts Edit + D1 Edit) และ `CLOUDFLARE_ACCOUNT_ID`

> **ห้ามใส่ secret ลง `wrangler.jsonc` หรือ commit ขึ้น git เด็ดขาด** — ใช้ `wrangler secret put` เท่านั้น ส่วน `.dev.vars` สำหรับ local ต้องอยู่ใน `.gitignore`

### 5.4 CI/CD (T0.7)

**สายงาน branch:** `feature/*` → PR เข้า `dev` → `dev` → PR เข้า `main` → production
`main` เป็น production ล้วน ห้าม push ตรง

```
PR เปิด/อัปเดต  (ci.yml)
  └→ install → lint → typecheck → test → build → bundle size gate
      └→ wrangler versions upload --env dev  →  คอมเมนต์ preview URL ใน PR

push เข้า dev  (deploy-dev.yml)
  └→ install → lint → typecheck → test → build
      └→ wrangler d1 migrations apply precare-dev-db --remote --env dev
          └→ opennextjs-cloudflare deploy -- --env dev  →  precare-dev

merge เข้า main  (deploy.yml)
  └→ install → lint → typecheck → test → build
      └→ wrangler d1 migrations apply precare-db --remote
          └→ opennextjs-cloudflare deploy  →  production
```

ทั้งสามใช้ `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` ชุดเดียวกัน ต่างกันที่ GitHub Environment (`dev` / `production`) และ variable ของ smoke check (`DEV_URL` / `PRODUCTION_URL`)

**กติกา:** migration ต้องรัน **ก่อน** deploy โค้ดใหม่เสมอ และต้องเขียนแบบ backward-compatible (เพิ่ม column ได้ / อย่าลบหรือ rename ใน migration เดียวกับที่โค้ดเปลี่ยน) เพราะ D1 ไม่มี rollback อัตโนมัติ

### 5.5 Go-live Checklist (T6.6)

- [ ] `npm run db:migrate:remote` (production) รันครบทุกไฟล์ · ผ่านบน dev มาก่อนแล้ว
- [ ] Secrets ครบทั้ง 5 ตัวใน production (และใน `--env dev` ครบเช่นกัน)
- [ ] Google OAuth redirect URI มี production URL แล้ว
- [ ] bundle < 3 MiB (gzip) — ถ้าเกินตัดสินใจเรื่อง Workers Paid
- [ ] Authorization test ผ่านทั้งชุด (T3.8) — **ข้อนี้ห้ามข้าม**
- [ ] E2E ผ่านบน production URL จริง
- [ ] ทดสอบบนมือถือจริงอย่างน้อย 2 เครื่อง
- [ ] `.dev.vars` และ secret ทั้งหมดไม่หลุดขึ้น git
- [ ] เปิดใช้ Cloudflare Web Analytics (ฟรี)
- [ ] ตั้ง billing alert ไว้กันเซอร์ไพรส์

---

## 6. Risk Register

| # | ความเสี่ยง | โอกาส | ผลกระทบ | ทางรับมือ |
|---|---|:---:|:---:|---|
| 1 | **bundle เกิน 3 MiB** บน Workers free | กลาง | สูง — deploy ไม่ได้ | เจอตั้งแต่ **T0.5** ไม่ใช่ตอนท้าย · ถ้าเกิน → Workers Paid $5/เดือน (10 MiB) |
| 2 | **ไม่มีปุ่มลืมรหัสผ่าน** | สูง | กลาง | ออกแบบข้อความชี้ทางไป Google login ในหน้า login (ดูหัวข้อ 0) + เร่ง Phase 1.5 |
| 3 | ~~**preview ใช้ D1 ร่วมกับ production**~~ | — | — | ✅ ปิดแล้ว — แยก `env.dev` + `precare-dev-db` ทั้ง preview และ dev deploy · ที่เหลือคือ **อย่าลืมเพิ่ม binding/secret ใหม่ใน `env.dev` ด้วย** เพราะ wrangler ไม่ inherit ให้ |
| 4 | **D1 ไม่มี row-level security** | — | สูง | authz check ทุก endpoint (T1.5) + **T3.8 เป็นงานบังคับ ห้ามตัดทิ้ง** |
| 5 | Browser Notification ไม่ทำงานตอนปิดแท็บ | สูง | ต่ำ | สื่อสารในหน้าตั้งค่าให้ชัด · แก้จริงด้วย Web Push + Service Worker ใน Phase 2 |
| 6 | Better Auth ต่างจากที่ architecture.md เขียนไว้ | — | ต่ำ | T0.2 อัปเดตเอกสารก่อนเริ่ม |
| 7 | อีเมลไม่ถูก verify (`requireEmailVerification: false`) | สูง | ต่ำ-กลาง | ยอมรับได้ช่วงทดลอง · เปิดใช้ทันทีใน Phase 1.5 |

---

## 6.5 Phase 2 — อัลบั้มและรูปภาพ

โครงหน้าจอวาดเสร็จแล้วตั้งแต่ Phase 1 (ดู `/album`, `/album/[id]`, `/profile/edit` ใน design canvas) เหลือแต่ลงมือทำ

| งาน | รายละเอียด | ประเมิน |
|---|---|---|
| ตาราง `photos` + API | CRUD + authz (viewer อัปโหลดไม่ได้) | 1 วัน |
| **แนบรูปในบันทึกสุขภาพ** | สูงสุด 10 รูป/บันทึก · ประเภท อัลตราซาวด์ / ครอบครัว / อื่นๆ | 1.5 วัน |
| **อัลบั้ม** `/album` | กริด 3 คอลัมน์ จัดกลุ่มตามสัปดาห์ + filter ตามประเภท | 1.5 วัน |
| **หน้าดูรูป** `/album/[id]` | ดูเต็มจอ + ข้อมูลรูป · ปุ่มแชร์แสดงเป็น disabled พร้อมป้าย Phase 3 | 1 วัน |
| **thumbnail** | เก็บ thumb แยกใน R2 ไม่ให้กริดโหลดรูปเต็ม | 0.5 วัน |

**รวม ~5.5 วัน** — ลดลงเพราะ R2 กับอัปโหลดรูปโปรไฟล์ย้ายไปทำใน Phase 1 แล้ว

### 6.6 Phase 2 — เนื้อหารายสัปดาห์ (ขนาดลูกน้อย + พัฒนาการ)

ข้อมูล 37 สัปดาห์รวบรวมเสร็จแล้วใน **[pregnancy-weekly-data.md](./pregnancy-weekly-data.md)** — ความยาว น้ำหนัก การเทียบขนาดกับผลไม้ไทย และคำบรรยายพัฒนาการ พร้อมแหล่งอ้างอิง

| งาน | รายละเอียด | ประเมิน |
|---|---|---|
| แปลงข้อมูลเป็น `src/data/weekly-content.ts` | static JSON ในโค้ด **ไม่ต้องเข้า D1** — 37 แถวคงที่ ไม่มีใครแก้ ประหยัด row reads | 0.5 วัน |
| ~~วาด illustration 37 ภาพ~~ | **ตัดออก** — ใช้ path คงที่ใน R2 แทน ทีมหารูปมาหย่อนเองได้ | **0 วัน** |
| route เสิร์ฟ asset + fallback | `/assets/*` อ่านจาก R2 + `cache-control: immutable` · ไม่มีไฟล์ → แสดงเลขสัปดาห์แทน | 0.5 วัน |
| การ์ด **ขนาดของลูกน้อย** | ภาพ + ชื่อผลไม้ + ความยาว/น้ำหนัก + ข้อความกำกับว่าเป็นค่าเฉลี่ย | 0.5 วัน |
| การ์ด **พัฒนาการของหนูน้อย** | คำบรรยายรายสัปดาห์ + chip หัวข้อ + ลิงก์อ่านเพิ่ม | 0.5 วัน |
| **ให้ผู้มีความรู้ทางการแพทย์ตรวจทาน** | โดยเฉพาะคำบรรยายภาษาไทยที่เรียบเรียงจากต้นฉบับอังกฤษ | — |

**รวม ~2 วัน** — ลดจาก 3.5 วันเพราะตัดงานวาดภาพออก

> **⚠️ 2 เรื่องที่พลาดไม่ได้**
> 1. **ต้องมีข้อความกำกับทุกครั้ง** ว่าเป็นค่าเฉลี่ยเพื่ออ้างอิง ไม่ใช่คำแนะนำทางการแพทย์ — คุณแม่ที่เห็นตัวเลขแล้วคิดว่าลูกตัวเล็กกว่าเกณฑ์จะกังวลเกินเหตุ
> 2. **สัปดาห์ที่ 21 ตัวเลขความยาวกระโดดจาก 16.4 เป็น 26.7 ซม.** เพราะเปลี่ยนวิธีวัดจาก *หัวถึงก้น* เป็น *หัวถึงส้นเท้า* — **ต้องอธิบายในแอป** ไม่งั้นผู้ใช้จะตกใจว่าทำไมลูกโต 10 ซม. ในสัปดาห์เดียว

> **ข้อควรระวังเรื่องโควตา:** R2 free tier 10 GB — ต้อง **resize ฝั่ง client ก่อนอัปโหลด** (จำกัดด้านยาวราว 1600px) ไม่งั้นรูปจากมือถือใบละ 3–5 MB จะกินโควตาหมดเร็วมาก

---

## 7. Phase 1.5 — งานอีเมล (ยกมาทำทีเดียว)

พอมี email service ทีเดียว จะปลดล็อก 4 อย่างพร้อมกัน — คุ้มกว่าทำแยก

| งาน | ปลดล็อกอะไร | ประเมิน |
|---|---|---|
| ต่อ email service + verify domain | พื้นฐานของทุกข้อล่าง | 0.5 วัน |
| **ลืมรหัสผ่าน** | ปิดช่องโหว่ที่ยอมรับไว้ใน Phase 1 | 1 วัน |
| **Email OTP login** | ติด `emailOTP` plugin ของ Better Auth — OTP สร้าง user อัตโนมัติได้ในตัว | 1–1.5 วัน |
| **ยืนยันอีเมลตอนสมัคร** | เปิด `requireEmailVerification: true` | 0.5 วัน |
| **อีเมลเชิญสมาชิกอัตโนมัติ** | เลิกให้ owner copy link เอง (ยังเก็บ copy link เป็น fallback) | 0.5 วัน |
| ออกแบบ email template | ใช้ร่วมกันทุกข้อ | 1 วัน |

**รวม ~4.5–5 วัน**

### 7.1 ใช้ Gmail ที่มีอยู่ส่งอีเมลได้ไหม — **ได้ และไม่ต้องมี domain**

**แต่ต้องเข้าใจข้อจำกัดของ Workers ก่อน:** Cloudflare Workers รันบน V8 isolate ที่ต่อ TCP ตรงไม่ได้ **Nodemailer จึงใช้ SMTP transport ไม่ได้** — นี่เป็นข้อจำกัดของ runtime ไม่ใช่ของ Gmail

**ทางที่ใช้ได้จริงมี 2 ทาง**

| | **A · Gmail API + OAuth2** | **B · worker-mailer + App Password** |
|---|---|---|
| วิธีทำงาน | HTTPS `fetch()` ไป Gmail REST API — Workers ทำได้ปกติ | SMTP ผ่าน `connect()` socket ของ Cloudflare (port 587/465) |
| ความแน่นอน | ✅ **มีตัวอย่างใช้งานจริงบน Workers แล้ว** | ⚠️ library รองรับ port + auth ที่ Gmail ใช้ แต่ **ยังไม่มีตัวอย่าง Gmail ที่ยืนยัน** ต้องทดสอบเอง |
| เวลาตั้งค่า | ~1–2 ชม. (Google Cloud project + OAuth consent + refresh token) | **~15 นาที** (เปิด 2FA → สร้าง App Password → ใส่เป็น secret) |
| ความเสี่ยงระยะยาว | ต่ำ — เป็น API ทางการ | กลาง — พึ่ง community library ตัวเล็ก |

> **แนะนำ:** ลอง **B ก่อน** เพราะตั้งค่า 15 นาที ถ้าส่งผ่านให้ใช้เลย · ถ้าติดปัญหาค่อยย้ายไป **A** ซึ่งเป็นทางที่การันตีว่าได้แน่ · โค้ดฝั่งเราแยก interface `sendEmail()` ไว้ตัวเดียว สลับ implementation ทีหลังได้ใน 1 ไฟล์

**⚠️ กับดักที่ต้องรู้ก่อนเลือกทาง A:** ถ้าปล่อย Google Cloud project ไว้สถานะ **"Testing"** refresh token จะ**หมดอายุทุก 7 วัน** แล้วระบบส่งอีเมลจะพังเงียบๆ — ต้อง publish เป็น **Production** ถึงจะได้ token ที่อยู่ถาวร

**⚠️ ต้องแยก Google Cloud project ออกเป็น 2 ตัว:**

| Project | Scope | ใครกดยินยอม | ต้อง verify ไหม |
|---|---|---|---|
| **Login** (T2.3) | `email`, `profile` — non-sensitive | ผู้ใช้ทุกคน | ไม่ต้อง ใช้ได้ไม่จำกัดคน |
| **ส่งอีเมล** | `gmail.send` — **sensitive** | **คุณคนเดียว ครั้งเดียว** | ไม่ต้อง แต่จะเห็นหน้าเตือน "unverified app" ตอนกดยินยอม และถูกจำกัดที่ 100 users |

ถ้าเอา `gmail.send` ไปใส่ project เดียวกับ login จะลากหน้าจอ login ของผู้ใช้ทุกคนไปติดข้อจำกัดของ sensitive scope ด้วย

**ข้อจำกัดที่ต้องยอมรับถ้าใช้ Gmail**

- **~500 ฉบับ/วัน** สำหรับ Gmail ฟรี (Workspace ได้ 2,000) — พอเหลือเฟือ เพราะแอปนี้ส่งแค่ OTP + คำเชิญ วันละไม่กี่สิบฉบับ
- **ผู้รับเห็นอีเมลส่วนตัวของคุณเป็นผู้ส่ง** และถ้าเขากด reply จะเด้งเข้ากล่องจดหมายส่วนตัวคุณ — รับได้ช่วงทดลองกับคนใกล้ตัว แต่ไม่เหมาะตอนเปิดใช้จริง
- Gmail Program Policies ไม่ได้ออกแบบมาสำหรับส่งอัตโนมัติ — ปริมาณระดับนี้ไม่มีปัญหาในทางปฏิบัติ แต่ถ้าโตขึ้นมีความเสี่ยงถูกจำกัดบัญชี
- ไม่ได้ตั้ง SPF/DKIM เอง deliverability พึ่งชื่อเสียงของ Gmail ล้วนๆ

### 7.2 สรุปทางเลือกเรื่อง domain

| ทาง | ค่าใช้จ่าย | เหมาะกับ |
|---|---|---|
| **Gmail ที่มีอยู่** | **$0** | ✅ **ช่วงทดลอง** — ปลดล็อก Phase 1.5 ได้ทันทีโดยไม่ต้องรอ ไม่ต้องจ่าย |
| domain + Resend | ~$10/ปี | ตอนเปิดใช้จริง — ส่งจาก `noreply@ชื่อแอป.com` ตั้ง SPF/DKIM ได้เอง |
| `nic.eu.org` + Resend | $0 | ถ้าไม่อยากจ่ายเลย แต่รออนุมัติเป็นสัปดาห์ |

**ผลต่อแผน:** Phase 1.5 **ไม่ต้องรอ domain อีกต่อไป** เริ่มได้ทันทีหลัง Phase 1 จบ · ตัดงาน "verify domain" (0.5 วัน) ออก เหลือ **~4–4.5 วัน**

---

## 8. สิ่งที่ต้องเตรียมจากฝั่งคุณ

| เมื่อไหร่ | ต้องทำอะไร | ใช้เวลา |
|---|---|---|
| ก่อน **T0.5** | ยืนยันว่าเข้า Cloudflare dashboard ได้ + รู้ Account ID | 5 นาที |
| ก่อน **T0.7** | สร้าง Cloudflare API Token (Workers Scripts Edit + D1 Edit) | 10 นาที |
| ก่อน **T2.3** | สร้าง OAuth client ใน Google Cloud Console → ได้ Client ID + Secret | 20 นาที |
| ก่อน **T4.1** | ยืนยันว่าจะให้ผมทำ design ต่อ หรือมี designer อยู่แล้ว | — |
| ก่อน **Phase 1.5** | เปิด 2FA บนบัญชี Gmail ที่จะใช้ส่ง แล้วสร้าง App Password | 10 นาที |

---

## 8.5 ของที่ตัดเวลา dev ได้ — สรุปจาก [tech-notes.md](./tech-notes.md)

| แนะนำ | แทนที่ | ประหยัด |
|---|---|---|
| **shadcn/ui + Tailwind v4** | เขียน Button/Input/Dialog/Toast เอง (T5.1) | ~2–3 วัน |
| **Server Actions + next-safe-action** | REST endpoint 8 กลุ่ม + fetch client (M3) | ~2–3 วัน |
| **drizzle-zod** | เขียน zod schema มือ | ~0.5 วัน |
| **ไม่ใช้ TanStack Query** | — | ~1 วัน + bundle เล็กลง |
| **ไม่ทำ admin panel รูป** | ใช้ `wrangler r2 object put` / dashboard | ~2 วัน |
| **ตัดงานวาด illustration** | ชี้ path ไป R2 | ~2 วัน |

**รวมประหยัด ~8–10 วัน จาก 26–32 วัน → เหลือราว 18–24 วัน**

> **จุดที่ต้องเข้าใจตรงกันเรื่องความปลอดภัย:** การเปลี่ยนไปใช้ Server Actions **ไม่ได้ทำให้กติกา "ทุก query ต้องเช็ค session + role ก่อนแตะ D1" อ่อนลง** — Server Action คือ RPC ฝั่ง server เหมือนกัน และการทำ authz เป็น middleware chain ทำให้ *ลืมไม่ได้* ต่างจาก 20 handler ที่ต้องจำเรียกเองทุกตัว

> **ต้อง spike ก่อน commit 2 เรื่อง:** (1) bundle size จริงหลังใส่ shadcn + Better Auth + Drizzle เทียบกับ limit 3 MiB (2) **Better Auth ทำ scrypt บน free plan ที่จำกัด CPU 10 ms/invocation ได้ไหม** — ข้อ 2 คือความเสี่ยงที่คนมองข้ามบ่อยที่สุด ถ้าไม่ผ่านต้องขึ้น Workers Paid $5/เดือน

---

## 9. ขั้นถัดไป

1. **ทำ design หน้าจอ (M4)** ← ที่คุยกันไว้ว่าจะทำต่อจากแผนนี้
2. M0 เริ่มได้ทันทีแบบขนาน เพราะไม่ต้องรอ design
