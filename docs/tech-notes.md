# Health Care — Tech Notes

> โน้ตเชิงเทคนิคสำหรับตัดสินใจก่อนเริ่ม dev · อัปเดต 25 ส.ค. 2569
> ทุกข้อระบุไว้ว่า **ตรวจสอบแล้ว** หรือ **เป็นความเห็น** — ข้อที่เป็นความเห็นควร spike สั้นๆ ก่อนตัดสินใจ

---

## 1. Asset Storage — ภาพเทียบขนาดรายสัปดาห์

**ข้อสรุป:** ไม่วาด illustration แล้ว · ใช้ **path คงที่ใน R2** แล้วหารูปมาใส่ทีหลังได้เรื่อยๆ **โดยไม่ต้อง deploy ใหม่**

### 1.1 แยก 2 bucket ตาม access model

นี่คือจุดที่พลาดแล้วแก้ทีหลังเจ็บ — **สิทธิ์การเข้าถึงต่างกันคนละแบบ อย่าเอามาปนกัน**

| Bucket | เนื้อหา | Access | Cache |
|---|---|---|---|
| `precare-assets` | ภาพเทียบขนาด 37 ภาพ, ไอคอน, asset ระบบ | **public** — ใครเปิดก็ได้ ไม่มีข้อมูลส่วนตัว | `immutable`, 1 ปี |
| `precare-photos` | รูปอัลตราซาวด์, รูปครอบครัว, avatar | **private** — ต้องผ่าน authz ทุก request | `private`, no-store |

### 1.2 โครงโฟลเดอร์

```
precare-assets/
  weekly/size/w04.webp          ← สัปดาห์ 4
  weekly/size/w05.webp
  ...
  weekly/size/w40.webp          ← สัปดาห์ 40  (37 ไฟล์)

precare-photos/
  family/{familyId}/avatars/{userId}.webp
  family/{familyId}/logs/{logId}/{photoId}.webp
```

**กติกาตั้งชื่อ:** `w` + เลขสัปดาห์ 2 หลักเติมศูนย์หน้า + `.webp` — `w04` ไม่ใช่ `w4`
**สเปกไฟล์:** WebP · 192×192 px (2× ของที่แสดงจริง 96px) · พื้นโปร่งใส · ไม่เกิน 40 KB/ไฟล์

### 1.3 โค้ดฝั่ง app — ไม่ต้องมี DB, ไม่ต้องมี manifest

```ts
// src/lib/assets.ts
export const weeklySizeImage = (week: number) =>
  `/assets/weekly/size/w${String(week).padStart(2, '0')}.webp`;
```

Route เดียวเสิร์ฟทั้ง bucket:

```ts
// app/assets/[[...key]]/route.ts
export async function GET(_: Request, { params }) {
  const key = (await params).key.join('/');
  const obj = await getCloudflareContext().env.ASSETS_BUCKET.get(key);
  if (!obj) return new Response(null, { status: 404 });
  return new Response(obj.body, {
    headers: {
      'content-type': 'image/webp',
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
}
```

**Fallback สำคัญมาก:** ไม่มีไฟล์ → 404 → การ์ดแสดงเลขสัปดาห์บนพื้น `peach-100` แทน ชื่อผลไม้ยังอยู่ครบ
→ **แอปทำงานได้ตั้งแต่วันแรกที่ยังไม่มีรูปสักใบ** แล้วรูปจะโผล่มาเองทีละใบตามที่คุณอัปโหลด (ดูตัวอย่างทั้ง 2 สถานะที่หน้า Component Library)

### 1.4 วิธีเอารูปขึ้น — ไม่ต้องเขียน admin panel

```bash
npx wrangler r2 object put precare-assets/weekly/size/w24.webp --file=./w24.webp --remote
```

หรือลากวางในหน้า R2 ของ Cloudflare dashboard ก็ได้ · **ประหยัดงานสร้าง admin panel ไปราว 2 วัน**

> **ทางเลือกที่เร็วกว่าแต่ต้อง deploy:** เอา 37 ไฟล์ไว้ใน `public/` แล้วให้ Workers Static Assets เสิร์ฟ — **ตรวจสอบแล้วว่า static assets ไม่นับรวมใน bundle limit 3 MiB** (free plan ได้ 20,000 ไฟล์ ไฟล์ละไม่เกิน 25 MiB) เร็วกว่าและไม่มี R2 read เลย **แต่ต้อง commit + deploy ทุกครั้งที่เพิ่มรูป** — ถ้าอยากหย่อนไฟล์เมื่อไหร่ก็ได้ ใช้ R2 ตามข้อ 1.2

---

## 2. ของที่ตัดเวลา dev ได้จริง

| # | แนะนำ | แทนที่งานเดิม | ประหยัด | สถานะ |
|---|---|---|---|:---:|
| 2.1 | **shadcn/ui + Tailwind v4** | เขียน Button/Input/Dialog/Sheet/Toast เอง (T5.1) | **~2–3 วัน** | ความเห็น |
| 2.2 | **Server Actions + next-safe-action** | เขียน REST endpoint 8 กลุ่ม + fetch client (M3) | **~2–3 วัน** | ตรวจสอบแล้ว* |
| 2.3 | **@cloudflare/vitest-pool-workers** | mock D1 ในเทสต์ | ไม่ประหยัดเวลาเขียน แต่ทำให้ T3.8 เชื่อถือได้จริง | ตรวจสอบแล้ว |
| 2.4 | **drizzle-zod** | เขียน zod schema มือ | ~0.5 วัน | ความเห็น |
| 2.5 | **ไม่ใช้ TanStack Query** | — | ~1 วัน + ลด bundle | ความเห็น |
| 2.6 | **ไม่ทำ admin panel ของรูป** | ใช้ wrangler / dashboard | ~2 วัน | — |

\* ตรวจสอบแล้วว่า OpenNext Cloudflare รองรับ Server Actions บน Node runtime · ส่วน `next-safe-action` เป็นความเห็น

**รวมประหยัดได้ ~8–10 วัน จากแผนเดิม 26–32 วัน**

---

### 2.1 shadcn/ui แทนการเขียน component เอง

Component ถูก **copy เข้า repo คุณ** ไม่ใช่ dependency — แก้ได้เต็มที่ ไม่มี runtime lock-in และไม่บวม bundle (สำคัญกับ limit 3 MiB) · ข้างใต้เป็น Radix จึงได้ focus management กับ a11y มาฟรี ซึ่งเป็นงานน่าเบื่อที่กินเวลาจริง

**สิ่งที่ต้องทำ:** map design token ของเราเข้า CSS variable ของ shadcn ครั้งเดียว

```css
:root {
  --primary: #6B4F3F;        /* brown-700 */
  --background: #FDFBF7;     /* cream-50  */
  --card: #FFFFFF;
  --border: #EFE6D8;         /* cream-200 */
  --muted-foreground: #6B6259;
  --radius: 12px;
}
```

> **ความเสี่ยงที่ต้องระวัง:** ถ้าใช้ค่า default ของ shadcn ตรงๆ จะได้หน้าตา "เว็บ AI ทั่วไป" ทันที — **ต้องลงแรง restyle ตาม design-system.md จริงๆ** ไม่ใช่แค่ `npx shadcn add button` แล้วจบ · component ที่เป็นเอกลักษณ์ของงานนี้ (MoodPicker, GestationProgressBar, DateBlock, PhotoTile) ยังต้องเขียนเองอยู่ดี

### 2.2 Server Actions แทน REST endpoints

**ตรวจสอบแล้ว:** OpenNext Cloudflare รองรับ Server Actions เต็มรูปแบบบน Node runtime

**แบ่งงานใหม่:**
- **อ่าน** → ดึงใน React Server Component ตรงๆ ไม่ต้องมี endpoint
- **เขียน** → Server Action

M3 เดิมมี 8 กลุ่ม endpoint + client fetch wrapper + serialization → เหลือแค่ action ต่อ mutation

**ประเด็นความปลอดภัยที่ต้องเข้าใจให้ตรงกัน:** กติกาใน `architecture.md` ที่ว่า *"ทุก query ต้องผ่าน layer ที่เช็ค session + role ก่อนแตะ D1"* **ยังอยู่ครบ ไม่ได้อ่อนลง** — Server Action คือ RPC endpoint ฝั่ง server เหมือนกัน ต่างแค่ไม่ต้องเขียน routing เอง

**และจริงๆ แล้วปลอดภัยกว่าเดิม** เพราะ `next-safe-action` ทำ authz เป็น **middleware chain** ได้:

```ts
const memberAction = actionClient
  .use(requireSession)              // 1) session ถูกต้องไหม
  .use(requireRole('editor'));      // 2) role พอไหม  ← เขียนครั้งเดียว

export const addWeeklyLog = memberAction
  .schema(insertWeeklyLogSchema)    // drizzle-zod (ข้อ 2.4)
  .action(async ({ parsedInput, ctx }) => { /* ctx.familyId, ctx.role พร้อมใช้ */ });
```

เทียบกับ 20 handler ที่ต้อง **จำ**ให้เรียก `requireRole()` ทุกตัว — แบบนี้ลืมไม่ได้เพราะมันอยู่ใน chain

> **ข้อจำกัดที่ต้องรู้:** Server Action เป็น POST-only RPC ไม่เหมาะกับอะไรที่ต้องให้ระบบภายนอกเรียก · ยังต้องมี REST จริงอยู่ 2 จุด: `/api/auth/*` (Better Auth เป็นเจ้าของ) และ `/assets/*` (ข้อ 1.3)

### 2.3 เทสต์ที่รันบน workerd จริง

**ตรวจสอบแล้ว:** `@cloudflare/vitest-pool-workers` รันเทสต์ใน **workerd ตัวเดียวกับ production** และต่อ binding จริงของ D1 / R2 / KV ได้โดยไม่ต้อง mock

มี API ให้พร้อม: `readD1Migrations()` อ่าน migration ทั้งหมด แล้ว `applyD1Migrations()` ยิงลง D1 ใน setup file

**ทำไมเรื่องนี้สำคัญกับโปรเจกต์นี้เป็นพิเศษ:** D1 ไม่มี row-level security เราจึงต้องพึ่ง authz ในโค้ด 100% — **T3.8 จึงเป็นงานบังคับที่ห้ามตัด** และการเทสต์กับ D1 จริงแทน mock คือสิ่งที่ทำให้เทสต์ชุดนั้นมีความหมาย ไม่ใช่แค่ผ่านเพราะ mock ตอบตามที่เราเขียน

### 2.4 drizzle-zod — schema เดียวใช้ทั้งระบบ

```ts
export const insertWeeklyLogSchema = createInsertSchema(weeklyLogs);
```

ได้ zod schema จาก table definition โดยตรง → ใช้ทั้ง validate ใน Server Action และ validate ฟอร์มฝั่ง client · แก้ schema ที่เดียว type กับ validation ขยับตามทั้งหมด

### 2.5 ไม่ต้องใช้ TanStack Query

พอ**อ่านผ่าน RSC / เขียนผ่าน Server Action** แล้ว state ฝั่ง client แทบไม่เหลือ — `revalidatePath()` จัดการ refresh ให้เอง · การใส่ client cache layer เข้ามาคือการสร้างงาน (และ bundle) ที่ไม่ได้ใช้ ซึ่งกินโควตา 3 MiB ฟรีๆ

---

## 3. เรื่องที่ควร spike สั้นๆ ก่อน commit

| เรื่อง | ทำไม | เวลา |
|---|---|---|
| **bundle size จริงหลังใส่ shadcn + Better Auth + Drizzle** | limit 3 MiB (gzip) บน free plan — ต้องรู้ตั้งแต่ T0.5 | 0.5 วัน |
| **Better Auth + Drizzle/D1 บน workerd** | scrypt กิน CPU — free plan จำกัด 10 ms/invocation ต้องวัดจริงว่า login ผ่านไหม | 0.5 วัน |
| **Workers Builds (git integration ของ Cloudflare)** | อาจแทน GitHub Actions ได้ ไม่ต้องจัดการ API token เอง — **ผมยังไม่ได้ตรวจสอบว่ารองรับ Workers ครบแค่ไหน** ลองดูก่อนตัดสินใจ | 0.5 วัน |

> **ข้อ 2 คือความเสี่ยงที่คนมองข้ามบ่อยที่สุด** — password hashing บน edge runtime ที่จำกัด CPU 10 ms เป็นจุดที่พังได้จริง ถ้าวัดแล้วไม่ผ่าน ทางออกคือขึ้น Workers Paid ($5/เดือน ได้ CPU มากขึ้น) หรือลด work factor ของ scrypt ลง

---

## 3.5 บทเรียนจาก CI ที่พังจริง (26 ส.ค. 69)

Deploy (dev) พังติดกัน 11 run ตั้งแต่ commit แรกที่มี `package.json` — บันทึกไว้กันพลาดซ้ำ

### `npm ci` พังบน Linux ทั้งที่ผ่านบน macOS

```
npm error code EUSAGE
npm error Missing: esbuild@0.28.2 from lock file   (+ @esbuild/* อีก 26 ตัว)
```

**สาเหตุ:** ติดตั้ง dependency ทีละตัวด้วย `npm install <pkg>` บน macOS ทำให้ dependency tree
ใน lock เอียงไปทาง darwin — `esbuild@0.28.2` (มาจาก `tsx` ของ drizzle-kit) ไปฝังใต้
`node_modules/tsx/` แทนที่จะ hoist ขึ้นมา พอ npm บน Linux คำนวณ tree ใหม่ได้คนละรูป จึงมองว่าไม่ sync

**แก้:** `rm -rf node_modules package-lock.json && npm install` แล้ว commit lock ใหม่
หลังแก้ package ที่ผูกแพลตฟอร์ม linux 114 / darwin 34 (เดิมเอียงไป darwin)

**กันไว้:** หลังเพิ่ม dependency ใหม่ ให้เช็คว่า lock มี linux ครบก่อน push

```bash
node -e "const l=require('./package-lock.json');const p=l.packages;const c=k=>Object.keys(p).filter(x=>x.includes(k)).length;console.log('linux',c('linux'),'darwin',c('darwin'))"
```

### wrangler พังโดยไม่บอกสาเหตุ

`The process '/opt/hostedtoolcache/node/22.23.2/x64/bin/npx' failed with exit code 1` — อ่านแล้วไม่รู้อะไรเลย
ที่จริงคือยังไม่ได้ตั้ง `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`

**แก้:** เพิ่ม preflight step ตรวจ secret ก่อนถึงขั้นที่ใช้ wrangler ทั้งใน `deploy.yml` และ `deploy-dev.yml`
ตอนนี้ถ้าไม่มี secret จะฟ้องชื่อที่ขาดพร้อมสิทธิ์ที่ต้องมี

### CI ไม่เคยรันบน dev

`ci.yml` ตั้ง `branches-ignore: [main, dev]` เพราะ `deploy-dev.yml` ตรวจชุดเดียวกันอยู่แล้ว
ผลข้างเคียงคือปัญหา lock file ไม่ถูกจับจนกว่าจะไปดู log ของ Deploy (dev) เอง
— ถ้าอยากได้ feedback เร็วขึ้น พิจารณาให้ CI รันบน dev ด้วย แล้วให้ deploy รอ CI ผ่านก่อน (`workflow_run`)

---

## 3.6 บทเรียนจากอัปโหลดรูปที่พัง (26 ส.ค. 69)

ฟีเจอร์อัลบั้มผ่าน tsc, eslint, authz check และ 72 เทสต์ แล้วก็ deploy เขียว
แต่กดใช้จริงแล้วเลือกไฟล์ไม่ขึ้นรูปเลย เพราะบั๊กอยู่ในชั้นที่ของพวกนั้นแตะไม่ถึง

**1. เทสต์รันใน workerd จึงไม่มี DOM**
`@cloudflare/vitest-pool-workers` ให้ D1 จริงและ Worker runtime จริง
ซึ่งดีมากสำหรับ query กับ authz แต่ไม่มี `window` ไม่มี `<input type=file>`
บั๊กจริงคือ `e.target.value = ""` ล้าง FileList ที่ถือ reference ไว้อยู่
(เป็น live object ตัวเดียวกับ `input.files`) — เป็น DOM semantics ล้วน
เทสต์ชุดนี้ไม่มีทางจับได้ และการเขียนเทสต์เพิ่มในชุดนี้ก็ไม่ช่วย

**2. ค่า default ที่ไม่ได้ตั้งเอง คือค่าที่ยังไม่ได้ตรวจ**
`serverActions.bodySizeLimit` default 1 MB ไม่มีอะไรเตือน build ผ่านปกติ
พังตอน runtime เท่านั้น ตอนนี้เลยตั้งค่าไว้ชัดเจนพร้อมเหตุผลใน `next.config.ts`
และ client กันไว้ที่ 16 MB เพื่อให้ error อ่านรู้เรื่อง

**3. เจอบั๊กแบบนี้ได้ทางเดียวคือกดใช้จริง**
วิธีที่ใช้ได้ผลโดยไม่ต้องรอคน: seed session ลง D1 local ตรงๆ
(`INSERT INTO session (token, ...)`) แล้วตั้ง cookie `better-auth.session_token=<token>.sig`
— `src/lib/session.ts` อ่าน token จาก D1 เอง ไม่ได้ verify signature
จึงเปิดหน้าที่ต้องล็อกอินได้เลย จากนั้นสร้าง File จาก canvas
ยัดเข้า input ผ่าน `DataTransfer` แล้ว dispatch `change`

**ข้อควรรู้ตอนทดสอบ:** หลัง restart dev server เบราว์เซอร์จะ 304 chunk เก่า
ของ Turbopack ทำให้หน้า hydrate ไม่สำเร็จ (`__reactProps` ไม่ขึ้นบน element)
เช็คก่อนทุกครั้งว่า hydrate แล้วจริง ไม่งั้นจะอ่านผลผิดว่าโค้ดพัง
ทางแก้คือเปิดแท็บใหม่

**สรุป:** เกณฑ์ "เสร็จ" ของฟีเจอร์ที่มี input จากผู้ใช้ ไม่ใช่ build ผ่าน + เทสต์เขียว
แต่คือกดใช้ครบ path ด้วยข้อมูลจริงขนาดจริงอย่างน้อยหนึ่งรอบ

## 3.7 สิ่งที่ E2E เจอตั้งแต่รันแรก (26 ส.ค. 69)

เขียน Playwright ให้รันกับ worker ที่ OpenNext build จริง ไม่ใช่ `next dev`
เพราะตัวที่ deploy คือ worker เจอสามเรื่องที่ไม่เคยรู้มาก่อน

**1. `rateLimit.max` ที่ตั้งไว้ ไม่เคยมีผลกับ /sign-in และ /sign-up**

better-auth มี special rule ในตัวที่ **3 ครั้ง / 10 วินาที** สำหรับ
`/sign-in`, `/sign-up`, `/change-password`, `/change-email`
ซึ่ง**ทับค่า `max` ที่เราตั้งเสมอ** (ดู `getDefaultSpecialRules` ใน
`node_modules/better-auth/dist/api/rate-limiter/index.mjs`)
ค่า `max: 20` ที่เขียนไว้ตอน T2.7 จึงมีผลกับ endpoint อื่นเท่านั้น

โชคดีที่ special rule เข้มกว่าที่เราตั้ง ความปลอดภัยจึงไม่ได้แย่ลง
แต่ comment ในโค้ดเคยเข้าใจผิดว่าค่านั้นคือตัวกันเดารหัสผ่าน — แก้แล้ว
`customRules` เป็นชั้นเดียวที่ทับ special rule ได้ ใช้เฉพาะตอนรันเทสต์

**2. Better Auth ผูกกับ origin ไม่ใช่แค่ cookie**

รัน worker คนละพอร์ตกับ `BETTER_AUTH_URL` แล้วได้ `Invalid origin`
ทุก request ไม่ใช่แค่ล้มตอน redirect — เวลาย้ายโดเมนต้องแก้ค่านี้ด้วยเสมอ

**3. Playwright ถือว่า navigation จบตอน load ซึ่งเกิดก่อน hydrate**

`setInputFiles` / `click` ในช่วงนั้น "สำเร็จ" ในสายตา Playwright แต่ React
ยังไม่ผูก handler event เลยหายไปเงียบๆ แล้วเทสต์จะ fail แบบดูเหมือนโค้ดพัง
ทั้งที่ไม่ได้พัง — เสียเวลาไล่หลายรอบกว่าจะรู้
`e2e/helpers.ts` มี `gotoApp()` ที่รอ hydrate ให้ ใช้ตัวนี้แทน `page.goto`
ทุกครั้งที่จะไปแตะอะไรบนหน้า (หน้าที่แค่อ่านอย่างเดียวใช้ `goto` ธรรมดาได้
และหน้าที่ viewer เห็นก็ไม่มีปุ่มให้รอ hydrate อยู่แล้ว)

**4. เทสต์ที่ไม่เคยเห็นแดง ไม่นับว่าเป็น gate**

ตอนแรกใช้รูป gradient เป็น fixture ซึ่งบีบอัดดีมาก ย่อแล้วเหลือหลักสิบ KB
เทสต์อัปโหลดจึงผ่านฉลุยแม้จะตั้ง `bodySizeLimit` กลับไปเป็น 1 MB ที่พังอยู่
เปลี่ยนเป็น noise ที่บีบไม่ลง (ใกล้รูปถ่ายมือถือจริง) ถึงจับได้
และใส่ assertion ไว้ว่าชุดทดสอบต้องเกิน 1 MB ไม่ให้กลายเป็นของปลอมเงียบๆ

**วิธีตรวจว่าเทสต์ใหม่ใช้ได้จริง:** ใส่บั๊กเดิมกลับเข้าไป รันให้เห็นแดง
แล้วค่อยเอาออก ทำกับทั้งสองบั๊กแล้ว

## 3.8 ช่องโหว่ที่เจอตอนทำ T6.5 (26 ส.ค. 69)

**`/api/media/[...key]` เช็คแค่ว่า "ล็อกอินอยู่ไหม"**

key เป็นรูปแบบเดาได้ `family/<familyId>/photos/<uuid>.webp` ใครก็ตามที่มีบัญชี
ในระบบจึงเปิดรูปอัลตราซาวด์ของครอบครัวอื่นได้ถ้ารู้ key และคนที่ถูกถอดออกจาก
ครอบครัวแล้วก็ยังเปิดรูปเก่าได้ตราบใดที่ session ยังไม่หมดอายุ

น่าสังเกตว่า `scripts/check-authz.mjs` จับไม่ได้ เพราะมันตรวจ **หน้าใน `src/app`
ที่เป็น page** กับ **action ที่ต้องกรอง familyId** — route handler ใน `api/`
ไม่อยู่ในขอบเขตที่มันดู กติกาที่บังคับด้วยเครื่องมือครอบไม่ถึงตรงไหน
ตรงนั้นคือที่ที่ช่องโหว่ไปโผล่

แก้โดยผูกสิทธิ์กับเจ้าของไฟล์จริงผ่าน `storage_objects` (ไฟล์ตัวเอง เช่น avatar
ดูได้เสมอแม้ย้ายครอบครัว / ไฟล์ของครอบครัวต้องเป็นสมาชิก active) และตอบ 404
ไม่ใช่ 403 ให้ตรงกับหลักใน `src/lib/authz.ts`

**CSP ทำได้แล้ว ไม่ต้องรอ Phase 2**

เดิมเลื่อนไว้เพราะคิดว่า nonce บน edge runtime มีข้อจำกัด แต่ทำได้ปกติ —
middleware สุ่ม nonce ต่อ request แล้วใส่ทั้งใน request header (`x-nonce`
ให้ Next หยิบไปใส่ script ของตัวเอง) และ response header
ที่ยังต้องผ่อนคือ `style-src 'unsafe-inline'` เพราะ Next ฝัง `<style>` เอง
และ `global-error.tsx` ใช้ `style={{...}}` ตั้งใจ (ต้องทำงานได้แม้ CSS พัง)

วิธีพังของ CSP ที่เงียบที่สุดคือ script ของ Next ถูกบล็อกแล้วหน้าไม่ hydrate
— หน้าดูปกติทุกอย่างแต่กดอะไรไม่ได้เลย `e2e/security.spec.ts` จึงไม่ได้เช็ค
แค่ว่ามี header ครบ แต่เดินเส้นทางจริงพร้อมดัก console error ของ CSP ด้วย

## 3.9 worker ตายกลางชุดเทสต์บน CI (27 ส.ค. 69)

Deploy ล้มที่ step E2E ทั้งที่รันในเครื่องผ่านหมด ไล่ตัดสมมติฐานในเครื่องแล้ว
ทั้ง D1 ว่างเปล่า, `CI=1`, และ `TZ=UTC` ก็ยังผ่าน 28/28 — ต้องขอ log จริงมาดู

**สิ่งที่ log บอก:** โปรเจกต์ mobile ผ่านครบ 14 เทสต์ พอขึ้น desktop
`wrangler dev` พ่น `✘ [ERROR]` แบบ**ข้อความว่างเปล่า** พร้อมข้อความชวนให้ไปเปิด
issue ที่ workers-sdk แล้ว process ตาย เทสต์ที่เหลือ 14 ตัวจึงล้มด้วย
`ERR_CONNECTION_REFUSED` ทั้งหมด

จังหวะที่ตายคือระหว่างเสิร์ฟ `/api/media/...` สามรูปพร้อมกัน

**สาเหตุที่แท้จริงยังไม่รู้** เพราะ error ไม่มีข้อความ และ log ของ wrangler
อยู่บนเครื่อง runner ที่เข้าไม่ถึง สิ่งที่ทำได้คือลดสิ่งที่น่าสงสัยที่สุดออก

**สองอย่างที่แก้ (ดีขึ้นจริงไม่ว่าสาเหตุคืออะไร)**

1. เลิกส่ง `obj.body` เป็นสตรีม เปลี่ยนเป็นอ่านทั้งก้อนด้วย `arrayBuffer()`
   ไฟล์ถูกจำกัดที่ 5 MB ตั้งแต่ตอนอัปโหลด และรูปที่ย่อแล้วอยู่ราว 200–400 KB
   การบัฟเฟอร์แทบไม่กินหน่วยความจำ แต่ตัดปัญหาอายุของสตรีมทิ้งทั้งหมด
   (เบราว์เซอร์ยกเลิกโหลดรูปกลางคันได้ตลอด)

2. เลิกตั้ง `content-length` เอง ปล่อยให้ runtime คำนวณจากไบต์จริง
   ค่าที่ตั้งเองมีโอกาสไม่ตรงกับที่ส่งออกไป ซึ่งเป็นความผิดพลาดที่หาสาเหตุยาก

พร้อมกันนั้นยุบ query สองรอบต่อรูปให้เหลือรอบเดียวด้วย leftJoin
เส้นทางนี้ถูกยิงทุกรูปในอัลบั้มพร้อมกัน การยิง D1 สองรอบต่อรูปกินโควตาเกินจำเป็น

**บทเรียนที่ต่างจาก §3.5:** คราวนั้นบทเรียนคือ "ขอ log ก่อน อย่าเดา"
คราวนี้ทำตามแล้วและได้ log มา แต่ log ไม่มีคำตอบ บทเรียนเพิ่มคือ
**เมื่อ error ไม่มีข้อความ ให้ตัดสิ่งที่ซับซ้อนที่สุดบนเส้นทางนั้นออกก่อน
แล้ววัดผลจาก CI จริง** ไม่ใช่ไล่เดาสาเหตุต่อ

**⚠️ ภาคต่อ (29 ส.ค. 69): การแก้ครั้งนั้นไม่ได้แก้จริง**

run 37 ตายซ้ำที่จุดเดิมเป๊ะ — หลังเสิร์ฟรูปสามใบพร้อมกันในเทสต์อัลบั้มใบแรก
run 33–36 ผ่านเพราะบังเอิญ ไม่ใช่เพราะการเปลี่ยนไปใช้ `arrayBuffer()` ได้ผล
เป็นบทเรียนตรงๆ ว่า **CI เขียวหนึ่งครั้งไม่ใช่หลักฐานว่าแก้ถูก
สำหรับบั๊กที่เกิดเป็นครั้งคราว** ต้องดูหลายรอบหรือหาสาเหตุให้เจอจริง

สิ่งที่ทำรอบนี้ต่างออกไป: แทนที่จะเดาต่อ ทำให้ **CI พ่น log ของ wrangler เอง**
ตอน E2E ล้ม (`~/.config/.wrangler/logs/*.log`) ซึ่งเป็นไฟล์ที่ stdout ไม่ได้แสดง
และ log ตัวนั้นเองเป็นที่เดียวที่บอกได้ว่า workerd ตายเพราะอะไร
พร้อมกับลดแรงกดของเทสต์ (รูป 3 ใบเหลือ 2 ใบ ยังเกิน 1 MB ตามที่ assertion ต้องการ)
และอัปเกรด wrangler ตามที่ตัว error แนะนำเอง

ถ้ายังตายอีก คราวหน้าจะมีข้อความจริงให้อ่านแล้ว

**ข้อสังเกตเรื่องโครงเทสต์:** webServer ตัวเดียวใช้ร่วมกันทั้งสองโปรเจกต์
ถ้ามันตาย เทสต์ที่เหลือจะล้มด้วย error ที่ชี้ไปผิดที่ทั้งหมด
ตอนอ่าน log ให้ดูเทสต์ **ตัวแรก**ที่ล้มเสมอ ตัวถัดๆ ไปเป็นผลพวง ไม่ใช่สาเหตุ

## 3.10 หาสาเหตุ worker ตายเจอแล้ว (29 ส.ค. 69)

หลังเดาผิดสองรอบ (§3.9) รอบนี้บั๊กเดียวกันเกิดขึ้น**ในเครื่องพัฒนา** จึงอ่าน
log ของ wrangler ได้โดยตรง ซึ่งเป็นไฟล์ที่บน CI เข้าไม่ถึง

**สาเหตุ**

```
Error in ProxyController: Error inside ProxyWorker
  stack: 'Error: Network connection lost.'
```

เป็นความผิดพลาดภายใน `wrangler dev` เอง ไม่ใช่โค้ดของแอป
ProxyWorker ที่ wrangler วางไว้หน้า worker จริงหลุดการเชื่อมต่อ แล้ว wrangler
ถือว่าเป็น error ระดับที่ต้องจบ process ทั้งตัว เทสต์ที่เหลือจึงล้มยกชุด
ด้วย `ERR_CONNECTION_REFUSED` ซึ่งชี้ไปผิดที่ทั้งหมด

เกิดทั้งบน wrangler 4.126.0 และ 4.127.1 จึงไม่ใช่ปัญหาเฉพาะเวอร์ชัน
และเกิดเป็นครั้งคราวภายใต้โหลดต่อเนื่อง มักตามหลังเทสต์ที่ยิงรูปหลายใบพร้อมกัน

**สิ่งที่เคยเดาผิดไป**

- เดาว่าเป็นการ stream `obj.body` จาก R2 → เปลี่ยนเป็น `arrayBuffer()` แล้วยังตาย
- เดาว่าเป็น `content-length` ที่ตั้งเอง → เอาออกแล้วยังตาย
- เดาว่าเป็น read-modify-write ของ `events` → แก้เป็น `json_insert` แล้วยังตาย

ทั้งสามอย่างยังเก็บไว้เพราะดีขึ้นในตัวมันเอง แต่ไม่มีอันไหนเป็นสาเหตุ

**บทเรียน**

การ "แก้" โดยไม่รู้สาเหตุแล้วเห็น CI เขียว ไม่ใช่หลักฐานว่าแก้ถูก
โดยเฉพาะกับบั๊กที่เกิดเป็นครั้งคราว — ต้องได้ log ของชั้นที่ตายจริง
ซึ่งคราวนี้ได้มาเพราะบังเอิญเกิดในเครื่องตัวเอง
step ที่เพิ่มไว้ใน CI ให้พ่น `~/.config/.wrangler/logs/*.log` ตอน E2E ล้ม
จะทำให้รอบหน้าไม่ต้องรอโชค

**เรื่องที่พยายามแล้วถอย: E2E ของสถานะเตือนเกิน 2 ชั่วโมง**

สถานะนี้เป็นสถานะสำคัญที่สุดของฟีเจอร์นับลูกดิ้น แต่ต้องรอจริง 2 ชั่วโมง
จึงทดสอบผ่าน UI ตรงๆ ไม่ได้ ลองสองทางแล้วถอยทั้งคู่

1. ย้อนเวลาในฐานข้อมูลด้วย `execFileSync("npx wrangler d1 execute ...")`
   พังหนัก — เรียก wrangler ซ้อนขณะที่ dev server ถือไฟล์ D1 อยู่ทำให้แย่งล็อกกัน
   และ `execFileSync` บล็อก event loop จน Playwright ตัดเวลาเทสต์ไม่ได้
   เทสต์เดียวกินไป 15 นาที และลาก process อื่นล้มตาม
   **ห้ามเรียก wrangler ซ้อนระหว่างที่ E2E รันอยู่**

2. เปิดให้ปรับเกณฑ์ผ่าน env แล้วตั้งให้ต่ำมากตอนเทสต์
   ตัวแปรตั้งได้สำเร็จ แต่เทสต์ยังค้าง 15 นาทีเหมือนเดิมโดยไม่ทราบสาเหตุ
   ถอยออกเพราะราคาที่จ่ายไปสูงกว่าที่ได้กลับมามาก

**สรุป:** สถานะนี้ครอบคลุมด้วย unit test ของ `isOverTimeLimit()` เท่านั้น
ส่วนการวาดหน้าจอยังไม่มีอะไรคุ้ม ถ้าจะทำจริงควรรอจนมี component test
ที่รันได้โดยไม่ต้องยก worker ทั้งตัวขึ้นมา

**เรื่องที่ไม่เกี่ยวกันแต่เจอพร้อมกัน**

`webServer.timeout` ที่ตั้งไว้ 240 วินาทีเริ่มไม่พอ เพราะคำสั่งนั้นทำสามอย่าง
ต่อกันบนฐานว่างเปล่า (migrate ทุกไฟล์ + build worker ใหม่ + สตาร์ต wrangler)
และจะช้าลงเรื่อยๆ ตามจำนวน migration ที่เพิ่มขึ้น
พอเกินจะขึ้น error ว่า webServer ไม่ยอมสตาร์ต ซึ่งชี้ไปผิดที่อีกเช่นกัน
ขยายเป็น 600 วินาทีแล้ว

## 4. CI gate ที่ควรมีตั้งแต่ PR แรก

```yaml
- run: npx opennextjs-cloudflare build
- run: |
    SIZE=$(gzip -c .open-next/worker.js | wc -c)
    echo "worker gzip: $SIZE bytes"
    [ "$SIZE" -lt 2621440 ] || { echo "เกิน 2.5 MiB — ใกล้ชน limit 3 MiB แล้ว"; exit 1; }
```

ให้ PR แดงตั้งแต่ตอนเพิ่ม dependency ที่หนัก ดีกว่าไปเจอตอน deploy วันส่งงาน
