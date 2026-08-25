# Precare

**Health Care** — web app ดูแลสุขภาพของครอบครัว
**Pre Care** — ฟีเจอร์บันทึกการตั้งครรภ์ ซึ่งเป็นฟีเจอร์แรกที่ลงมือทำ (Phase 1)

> สถานะปัจจุบัน: **ออกแบบเสร็จ ยังไม่เริ่มเขียนโค้ด** — repo นี้เก็บเอกสารออกแบบและไฟล์ต้นทางของ design canvas

---

## เริ่มอ่านตรงไหน

| ไฟล์ | เนื้อหา |
|---|---|
| [docs/project-plan.md](docs/project-plan.md) | แผนงาน 7 milestone, task breakdown, แผน deploy, risk register |
| [docs/tech-notes.md](docs/tech-notes.md) | โน้ตเทคนิค — asset storage, ของที่ตัดเวลา dev ได้ ~8–10 วัน, เรื่องที่ต้อง spike ก่อน commit |
| [docs/screen-blueprint.md](docs/screen-blueprint.md) | โครงหน้าจอ 18 routes, role→UI matrix, flow, component inventory |
| [docs/design-system.md](docs/design-system.md) | พาเลตต์, typography, spacing, component spec |
| [docs/architecture.md](docs/architecture.md) | ER diagram, DDL, permission matrix ⚠️ *ยังไม่อัปเดตเป็น Workers + Better Auth — ดู T0.2* |
| [docs/pregnancy-weekly-data.md](docs/pregnancy-weekly-data.md) | ข้อมูลขนาดทารก + พัฒนาการ 37 สัปดาห์ พร้อมแหล่งอ้างอิง |

## Stack ที่จะใช้

| Layer | เทคโนโลยี |
|---|---|
| Framework | Next.js 16 + `@opennextjs/cloudflare` |
| Hosting | **Cloudflare Workers** (ไม่ใช่ Pages — `next-on-pages` ถูก deprecate แล้ว) |
| Database | Cloudflare D1 + Drizzle ORM |
| Storage | Cloudflare R2 — `precare-assets` (public) / `precare-photos` (private) |
| Auth | Better Auth — Google OAuth + อีเมล/รหัสผ่าน (อีเมลคือ username) |
| UI | Tailwind v4 + shadcn/ui, Noto Sans Thai |
| Test | Vitest + `@cloudflare/vitest-pool-workers` (รันใน workerd จริง) |

## design/

ไฟล์ต้นทางของ design canvas — แก้ [design/gen.py](design/gen.py) แล้วรัน `python3 gen.py` จะ generate ไฟล์ `.dc.html` ทุกหน้าจอใหม่ทั้งหมด

## ข้อควรระวังก่อนเริ่ม dev

1. **bundle limit 3 MiB (gzip)** บน Workers free plan — ต้องวัดตั้งแต่ deploy ครั้งแรก
2. **CPU 10 ms/invocation** บน free plan — ต้องทดสอบว่า password hashing ของ Better Auth ผ่านไหม
3. **D1 ไม่มี row-level security** — authz ต้องทำในโค้ดทุก path และเทสต์ให้ครบ
4. ห้าม commit `.dev.vars` หรือ secret ใดๆ — ใช้ `wrangler secret put`

---

## CI/CD

| Workflow | ทำงานเมื่อ | ทำอะไร |
|---|---|---|
| [`ci.yml`](.github/workflows/ci.yml) | เปิด/อัปเดต PR | lint → typecheck → test → build → **bundle size gate** → อัปโหลด preview version + คอมเมนต์ URL ใน PR |
| [`deploy.yml`](.github/workflows/deploy.yml) | merge เข้า `main` | ตรวจซ้ำทั้งชุด → **apply D1 migrations** → deploy → smoke check |

ทั้งสอง workflow **ข้ามขั้น build/test อัตโนมัติถ้ายังไม่มี `package.json`** จึงเขียวได้ตั้งแต่ตอนที่ repo ยังมีแต่เอกสาร แล้วเริ่มทำงานจริงเองเมื่อโค้ดแอปลงมา

### ต้องตั้งค่าใน GitHub ก่อนใช้งานจริง

**Settings → Secrets and variables → Actions**

| ชื่อ | ประเภท | ได้มาจากไหน |
|---|---|---|
| `CLOUDFLARE_API_TOKEN` | Secret | Cloudflare → My Profile → API Tokens · ต้องมีสิทธิ์ **Workers Scripts: Edit** + **D1: Edit** |
| `CLOUDFLARE_ACCOUNT_ID` | Secret | Cloudflare dashboard → Workers & Pages (มุมขวา) |
| `PRODUCTION_URL` | Variable | เช่น `https://precare.<subdomain>.workers.dev` — ถ้าไม่ตั้ง smoke check จะข้ามไปเฉยๆ |

> `deploy.yml` ผูกกับ environment ชื่อ `production` — จะตั้ง required reviewer ที่ **Settings → Environments** เพื่อบังคับให้มีคนกดอนุมัติก่อน deploy ก็ได้

### กติกาที่ workflow บังคับไว้

1. **bundle gzip ต้องต่ำกว่า 3 MiB** — เกิน 2.5 MiB เตือน, เกิน 3 MiB PR แดงทันที (เพดานจริงของ Workers free plan)
2. **migration รันก่อน deploy เสมอ** และต้องเขียนแบบ backward-compatible — เพิ่ม column ได้ แต่อย่าลบหรือ rename ใน migration เดียวกับที่โค้ดเปลี่ยน เพราะ **D1 ไม่มี rollback อัตโนมัติ**
3. **deploy ทีละครั้ง ห้ามซ้อน** (`concurrency: deploy-production`) กัน migration ชนกัน

### ชื่อ D1 ที่ workflow อ้างถึง

`deploy.yml` ใช้ `D1_DATABASE_NAME: precare-db` — ต้องตรงกับชื่อใน `wrangler.jsonc` ถ้าเปลี่ยนชื่อ database แก้ที่ `env` ด้านบนของ workflow ที่เดียว
