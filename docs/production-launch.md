# ขึ้น production ครั้งแรก

สถานะ ณ 27 พ.ย. 2569 — **ยังไม่เคยขึ้น production** ข้อมูลจริงทั้งหมดอยู่บน dev

| | dev (ใช้งานจริงอยู่) | production |
|---|---|---|
| เว็บ | precare-dev.precare.workers.dev | precare.precare.workers.dev (ยังเป็นตัวว่างที่อัปโหลดไว้ 25 ส.ค.) |
| ฐาน D1 | `precare-dev-db` — 10 ผู้ใช้ 7 ครอบครัว 13 นัด 52 รูป | `precare-db` — ว่าง ยังไม่เคยรัน migration |
| รูป/วิดีโอ (R2) | `precare-photos` | `precare-photos` **ตัวเดียวกัน** — ไม่ต้องย้ายไฟล์ |
| secret แอป | ครบ | **ไม่มีเลย** |

**ห้าม merge `dev` → `main` จนกว่าจะทำข้อ 1–2 เสร็จ** merge แล้ว `deploy.yml` จะรัน migration
ลงฐานว่างแล้ว deploy ทันที ได้เว็บที่ login ไม่ได้ (ไม่มี `BETTER_AUTH_SECRET`)

## 0. สำรองข้อมูล dev ก่อน — ตอนนี้ไม่มีอะไรสำรองให้

รอบสำรอง 02:20 ทำงานที่ `precare-cron-dev` ด้วย แต่ worker นั้นยังไม่มี `CF_ACCOUNT_ID` /
`CF_API_TOKEN` (มีแค่ตัว production) ทุกคืนจึงจด `not_configured` แล้วจบ — ข้อมูลจริงที่อยู่บน
dev ไม่มีสำรองเลย ตั้งสองตัวนี้ (ค่าเดียวกับที่ตั้งให้ production ได้ ถ้า token มีสิทธิ์ D1:Edit ทั้งบัญชี):

```bash
npx wrangler secret put CF_ACCOUNT_ID --config workers/cron/wrangler.jsonc --env dev
```

```bash
npx wrangler secret put CF_API_TOKEN --config workers/cron/wrangler.jsonc --env dev
```

และสำรองมือไว้หนึ่งชุดก่อนแตะอะไร (ไฟล์มีข้อมูลส่วนตัว — ห้าม commit เก็บนอกรีโป):

```bash
npx wrangler d1 export precare-dev-db --remote --output ~/precare-dev-backup.sql
```

D1 มี Time Travel ด้วย (ย้อนได้ 7 วันบน Free) — `npx wrangler d1 time-travel info precare-dev-db`

## 1. ตั้ง secret ของ production

แอป (`precare`) — ตัวที่ dev มีและ production ยังไม่มี:

```bash
npx wrangler secret put BETTER_AUTH_SECRET
```

ใช้ค่าใหม่ ไม่ใช้ของ dev (สร้างด้วย `openssl rand -base64 32`) ส่วน `VAPID_PRIVATE_KEY`
ต้องเป็นคู่ของ public key ใน `wrangler.jsonc` ซึ่งตอนนี้ dev กับ production ใช้ public key
ตัวเดียวกัน จึงใช้ private key ตัวเดิมของ dev ได้:

```bash
npx wrangler secret put VAPID_PRIVATE_KEY
```

```bash
npx wrangler secret put VAPID_PRIVATE_KEY --config workers/cron/wrangler.jsonc
```

ที่เหลือ (`BREVO_API_KEY`, `BREVO_SENDER` สำหรับอีเมลลืมรหัส, `GOOGLE_CLIENT_SECRET` สำหรับ
login ด้วย Google) ตั้งแบบเดียวกัน — Google ต้องเพิ่ม redirect URI ของโดเมน production ใน
Google Cloud Console ด้วย ไม่งั้นปุ่ม Google ใช้ไม่ได้

## 2. เลือกว่าจะเอาข้อมูลไปด้วยไหม

**ก. เริ่ม production ว่าง** — ทุกคนสมัครใหม่ ข้อมูล dev อยู่ที่เดิม ไม่หาย ข้ามไปข้อ 3

**ข. ย้ายข้อมูล dev ไป production** — ต้องทำก่อน merge เพราะไฟล์ export มีทั้งโครงสร้างตาราง
และตาราง `d1_migrations` (migration ใน deploy จะเห็นว่ารันครบแล้วและข้ามไป)

1. บอกคนในบ้านให้หยุดบันทึกช่วงย้าย (ไม่กี่นาที) — ของที่บันทึกบน dev หลัง export จะไม่ตามไป
2. export ใหม่ทันทีก่อน import (ใช้ชุดในข้อ 0 ไม่ได้ถ้าห่างกันนาน)
3. ตรวจว่า production ยังว่างจริง (มีแค่ `_cf_KV`, `d1_migrations` ว่าง, `sqlite_sequence`)
   ถ้า import ฟ้องว่า `d1_migrations` มีอยู่แล้ว ให้ลบตารางว่างนั้นก่อน
   (`DROP TABLE d1_migrations`) — ตรวจก่อนว่า `SELECT count(*) FROM d1_migrations` เป็น 0 แล้ว import:

   ```bash
   npx wrangler d1 execute precare-db --remote --file ~/precare-dev-backup.sql
   ```

4. ล้างสิ่งที่ผูกกับโดเมน dev — การลงทะเบียนแจ้งเตือนผูกกับเว็บที่กดเปิด จึงต้องกดเปิดใหม่บน
   production ส่วน session ใช้ไม่ได้อยู่แล้ว (คนละ secret) ทุกคน login ใหม่ด้วยรหัสเดิม

   ```bash
   npx wrangler d1 execute precare-db --remote --command "DELETE FROM push_subscriptions; DELETE FROM session;"
   ```

5. นับแถวเทียบกับ dev (user, families, appointments, photos) ให้ตรงกัน

รูปไม่ต้องย้าย — อยู่ bucket เดียวกันแล้ว และกุญแจเซ็นลิงก์รูปอยู่ในตาราง `app_secrets`
ที่ย้ายไปพร้อมกัน

## 3. merge และตรวจ

merge PR `dev` → `main` แล้วดู workflow "Deploy" — ลำดับคือ migration → media → cron → แอป
→ ตรวจว่าเว็บตอบ 200

หลัง deploy: login ได้ · เห็นข้อมูล (ถ้าย้าย) · รูปเปิดได้ · เปิดแจ้งเตือนแล้วได้รับ ·
คืนแรกดู `SELECT * FROM backup_runs ORDER BY rowid DESC LIMIT 1` บน `precare-db` ต้องเป็น `ok`

**cron trigger** — บัญชี Free ได้ 5 ตัวทั้งบัญชี ตอนนี้ cron ใช้ worker ละ 1 ตัว (dev + production
= 2) ถ้าเพิ่ม cron ใหม่ต้องนับรวมทั้งสองสภาพแวดล้อม
