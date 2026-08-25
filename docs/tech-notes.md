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

## 4. CI gate ที่ควรมีตั้งแต่ PR แรก

```yaml
- run: npx opennextjs-cloudflare build
- run: |
    SIZE=$(gzip -c .open-next/worker.js | wc -c)
    echo "worker gzip: $SIZE bytes"
    [ "$SIZE" -lt 2621440 ] || { echo "เกิน 2.5 MiB — ใกล้ชน limit 3 MiB แล้ว"; exit 1; }
```

ให้ PR แดงตั้งแต่ตอนเพิ่ม dependency ที่หนัก ดีกว่าไปเจอตอน deploy วันส่งงาน
