# Health Care — Screen Blueprint (Phase 1)

> **ชื่อเรียก:** **Health Care** = ตัว web app · **Pre Care** = ฟีเจอร์บันทึกการตั้งครรภ์ ซึ่งเป็น **1 ในฟีเจอร์** ของ Health Care และเป็นฟีเจอร์แรกที่ลงมือทำ
> หน้าจอส่วนใหญ่ในเอกสารนี้อยู่ใต้ Pre Care ยกเว้น Auth / โปรไฟล์ / อัลบั้ม ที่เป็นของ Health Care ส่วนกลาง

> **สถานะ:** โครงหน้าจอสำหรับส่งต่อไปทำ visual design — ยังไม่ลงมือ coding
> **อ้างอิง:** [architecture.md](./architecture.md) (ER + API layer), [design-system.md](./design-system.md) (สี/ฟอนต์/component)
> **อัปเดต:** 2026-08-25

---

## 0. ขอบเขต Phase 1

| ใน Phase 1 | ไม่อยู่ใน Phase 1 |
|---|---|
| Auth — Google OAuth + **อีเมล/รหัสผ่าน** | **Email OTP + ลืมรหัสผ่าน (Phase 1.5)** |
| Onboarding → สร้าง family + ตั้ง LMP/EDD | โหมดหลังคลอด / baby logs (Phase 3) |
| Dashboard: อายุครรภ์ + countdown | อัปโหลดรูปอัลตราซาวด์ (R2) — เลื่อนไป Phase 2 |
| บันทึกสุขภาพ (list + form CRUD) | กราฟ trend น้ำหนัก/ความดัน — nice-to-have |
| นัดหมายแพทย์ (list + form CRUD + reminder) | ส่งอีเมลเชิญอัตโนมัติ (MVP ใช้ copy link) |
| — | Dark mode — **ตัดออกแล้ว** |
| — | **อัลบั้มรูป + แนบรูปในบันทึก (Phase 2)** |
| — | ปุ่มแชร์รูปลง social (Phase 3) |
| จัดการครอบครัว (list + invite + role badge) | สลับหลาย family (MVP บังคับ 1 active family) |
| โปรไฟล์/ตั้งค่า + logout | |

> **ตัดสินใจแล้ว (25 ส.ค. 69) — Auth ของ Phase 1 เหลือ 2 ทาง**
>
> | | |
> |---|---|
> | ✅ **Google OAuth** | ทางหลัก ใช้ได้ทุกคน ไม่ต้องมี domain |
> | ✅ **อีเมล + รหัสผ่าน** | **อีเมลคือ username** ไม่มีฟิลด์ username แยก |
> | ⏭ Phone OTP | ตัดถาวร — ต้องพึ่ง SMS gateway ที่คิดเงินรายข้อความ |
> | ⏭ Email OTP | **เลื่อนไป Phase 1.5** พร้อมงานอีเมลทั้งก้อน |
>
> **ผลที่ตามมา:** Phase 1 ไม่ต้องพึ่งบริการภายนอกเลยสักตัว ไม่ต้องมี domain ไม่ต้องมี email service — แต่แลกกับ **ไม่มีปุ่มลืมรหัสผ่าน** ดูวิธีรับมือใน §4.1

**หลักการที่คุมทุกหน้า** (สรุปจาก design-system.md): mobile-first, touch target ≥ 44px, พื้นหลัง cream/white 90%, สีน้ำตาลใช้เฉพาะจุดเน้น, และ **viewer ต้องไม่เห็นปุ่มแก้ไขเลย ไม่ใช่แค่ disabled**

---

## 1. Site Map

**18 routes** — ตัด `/verify-otp` + `/forgot-password` ออก แล้วเพิ่ม `/album`, `/album/[id]`, `/profile/edit`

> **การเปลี่ยนโครง IA (25 ส.ค. 69):** `ครอบครัว` ออกจาก bottom nav ไปเป็นแถวในโปรไฟล์ · ช่องที่ว่างให้ **อัลบั้ม** แทน
> เหตุผล: จัดการครอบครัวเป็นงานที่ทำนานๆ ครั้ง (ตั้งค่าแล้วจบ) ส่วนอัลบั้มเป็นของที่เปิดดูบ่อย — ตำแหน่งใน bottom nav ควรให้ของที่ใช้บ่อยกว่า


```
/                              → redirect: มี session ? /dashboard : /login
│
├─ PUBLIC (ไม่ต้อง login)
│  ├─ /login                   เข้าสู่ระบบ
│  ├─ /signup                  สมัครสมาชิก
│  └─ /invite/[token]          หน้ารับคำเชิญ (เปิดได้ทั้งมีและไม่มี account)
│
├─ ONBOARDING (login แล้ว แต่ยังไม่มี active_family_id)
│  └─ /onboarding              wizard 4 ขั้น
│
└─ APP (login แล้ว + มี family) ── มี Bottom Nav / Sidebar
   │  Bottom Nav: หน้าแรก / สุขภาพ / นัดหมาย / อัลบั้ม / โปรไฟล์
   ├─ /dashboard               หน้าแรก   ← Pre Care
   ├─ /health                  บันทึกสุขภาพ (list)
   │  ├─ /health/new           ฟอร์มเพิ่ม
   │  └─ /health/[id]/edit     ฟอร์มแก้ไข
   ├─ /appointments            นัดหมายแพทย์ (list)
   │  ├─ /appointments/new     ฟอร์มเพิ่ม
   │  └─ /appointments/[id]/edit
   ├─ /album                   อัลบั้มรูป            ← Phase 2
   │  └─ /album/[id]           ดูรูป + แชร์ (แชร์ = Phase 3)
   └─ /profile                 โปรไฟล์ + ตั้งค่า      ← ทางเข้าครอบครัว
      ├─ /profile/edit         แก้ไขโปรไฟล์ + อัปโหลดรูป
      ├─ /profile/pregnancy    แก้ LMP/วันคาดคลอด (owner เท่านั้น)
      └─ /family               จัดการครอบครัว   ← ย้ายออกจาก bottom nav
         └─ /family/invite     เชิญสมาชิก
```

---

## 2. Navigation Model

### Mobile (< 768px) — หลัก
- **Bottom Nav 5 แท็บ** ตรึงล่างจอ สูง 64px + safe-area inset
  `หน้าแรก` (Home) / `สุขภาพ` (HeartPulse) / `นัดหมาย` (CalendarDays) / **`อัลบั้ม` (Image)** / `โปรไฟล์` (User)
- Active state: pill `brown-100` + icon/label `brown-700`
- **Top App Bar** สูง 56px: ชื่อหน้า + ปุ่ม action ขวา (ถ้ามี) — หน้า Dashboard ใช้ avatar + **ชื่อฟีเจอร์ `Pre Care` พร้อมจุดสี `clay-500`** + ชื่อ family ด้านล่าง เพื่อบอกว่ากำลังอยู่ฟีเจอร์ไหนของ Health Care
- หน้าฟอร์ม (`/new`, `/edit`) เปิดเป็น **full-screen page** ไม่ใช่ modal — ปุ่มปิดเป็น `X` ซ้ายบน, ปุ่มบันทึกตรึงล่าง (ซ่อน bottom nav)

### Tablet / Desktop (≥ 768px)
- Bottom nav → **Left Sidebar** กว้าง 240px, bg `cream-100`, โลโก้บน + เมนู 5 รายการ + ชื่อ family/ผู้ใช้ล่างสุด
- Content container `max-width: 1120px`, คอลัมน์อ่านหลัก 720px, padding `space-12`
- Dashboard ที่ ≥1024px แตกเป็น 2 คอลัมน์ (หลัก 2fr / sidebar การ์ดรอง 1fr)
- หน้าฟอร์มที่ ≥768px เปิดเป็น **modal** ซ้อน list (radius-lg, shadow-modal) แทน full-screen

### FAB (ปุ่มเพิ่ม)
- อยู่เฉพาะหน้า `/health` และ `/appointments`, ลอยมุมขวาล่างเหนือ bottom nav 16px, ขนาด 56px, `radius-full`, bg `brown-700`, icon `Plus` สีขาว
- **ซ่อนทั้งปุ่มเมื่อ role = viewer**

---

## 3. Global States & Patterns

ทุกหน้าที่ดึงข้อมูลต้องออกแบบครบ 4 สถานะนี้ — ให้ designer วาดอย่างน้อย empty + default

| State | รูปแบบ |
|---|---|
| **Loading** | Skeleton แบบ shimmer สี `cream-100`/`cream-200` ทรงเดียวกับการ์ดจริง — ไม่ใช้ spinner กลางจอ ยกเว้นตอน auth redirect |
| **Empty** | Illustration เส้นนุ่มโทน brown-300 + หัวข้อ H2 + คำอธิบาย Body Small `ink-600` + ปุ่ม primary (ซ่อนปุ่มถ้า viewer) |
| **Error** | การ์ด inline bg `cream-100` border `danger` 1px + ข้อความ + ปุ่ม "ลองใหม่" ghost — ไม่ใช้ modal เต็มจอ |
| **Saving** | ปุ่มเปลี่ยนเป็น disabled + spinner ในปุ่ม, ฟอร์มทั้งหมด readonly |
| **Success** | Toast ลอยบน bottom nav, bg `white`, border-left 3px `success`, auto-dismiss 3 วิ |

**Form validation:** validate ตอน blur + ตอน submit (ไม่ validate ระหว่างพิมพ์) ข้อความ error วางใต้ input, Caption สี `danger`, border input → `danger`

**Confirm ก่อนลบ:** dialog เล็ก (radius-lg, ไม่เต็มจอ) — หัวข้อ / ผลที่ตามมา / ปุ่ม `ยกเลิก` (secondary) + `ลบ` (danger)

---

## 4. Auth Screens

### 4.1 `/login` — เข้าสู่ระบบ

**ทางเข้า 2 แบบ:** Google OAuth · อีเมล + รหัสผ่าน — **อีเมลคือ username ไม่มีฟิลด์ username แยก**

**Layout (จัดกลางแนวตั้ง, max-width 400px)**
1. โลโก้ + ชื่อแอป (Display) + tagline Body Small `ink-600`
2. ปุ่ม **"เข้าสู่ระบบด้วย Google"** — secondary variant เต็มความกว้าง ไอคอนซ้าย ← *วางบนสุดเพราะเป็นทางหลัก*
3. Divider "หรือ" — เส้น `cream-200` + Caption กลาง
4. **input อีเมล** — `type="email"`, `autocomplete="username"`, placeholder `you@example.com`
5. **input รหัสผ่าน** — `autocomplete="current-password"` + ปุ่มตา toggle แสดง/ซ่อน
6. ปุ่ม primary **"เข้าสู่ระบบ"** เต็มความกว้าง
7. **ข้อความช่วยเรื่องลืมรหัสผ่าน** (ดูกล่องด้านล่าง)
8. ท้าย: "ยังไม่มีบัญชี? **สมัครสมาชิก**" ลิงก์ `brown-500`

> **⚠️ Phase 1 ยังไม่มีปุ่ม "ลืมรหัสผ่าน"** เพราะการรีเซ็ตต้องส่งอีเมล ซึ่งยังไม่มี email service
>
> **สิ่งที่ designer ต้องออกแบบแทน** — ข้อความ Caption ใต้ปุ่มเข้าสู่ระบบ บนพื้น `cream-100` radius-sm:
> *"ลืมรหัสผ่าน? ตอนนี้ยังรีเซ็ตเองไม่ได้ — ถ้าอีเมลของคุณเป็น Gmail ให้กดเข้าสู่ระบบด้วย Google ด้านบนได้เลย ระบบจะพาเข้าบัญชีเดิมให้อัตโนมัติ"*
>
> ใช้ได้จริงเพราะระบบทำ **account linking** เมื่ออีเมลตรงกัน — ต้องเขียนให้เป็นทางออก ไม่ใช่คำขอโทษ

**States**
- อีเมลหรือรหัสผ่านผิด → การ์ด inline เหนือฟอร์ม "อีเมลหรือรหัสผ่านไม่ถูกต้อง" (ไม่ระบุว่าอันไหนผิด — กัน account enumeration)
- ใส่ผิดถี่เกิน → ข้อความ + countdown ปุ่ม disabled
- อีเมลนี้สมัครไว้ด้วย Google เท่านั้น → "บัญชีนี้ใช้ Google เข้าสู่ระบบ" + ชี้กลับไปที่ปุ่ม Google

### 4.2 `/signup` — สมัครสมาชิก

โครงเดียวกับ login ต่างที่ฟอร์ม

1. ปุ่ม Google + divider เหมือนกันทุกอย่าง
2. **ชื่อ-นามสกุล** — text
3. **อีเมล** — `autocomplete="username"` · เป็น identifier ของบัญชี validate ตอน blur
4. **รหัสผ่าน** — `autocomplete="new-password"` + **password strength meter** (แถบ 3 ขีด สี `success` / `warning` / `danger`) + hint เกณฑ์ขั้นต่ำ
5. checkbox ยอมรับเงื่อนไข + ลิงก์นโยบาย — บังคับติ๊กก่อนกดปุ่มได้
6. ปุ่ม primary "สมัครสมาชิก" → สำเร็จ → `/onboarding`

**States:** อีเมลซ้ำ → error ใต้ช่องอีเมล "อีเมลนี้มีบัญชีอยู่แล้ว" + ลิงก์ "เข้าสู่ระบบแทน"

> **หมายเหตุ Phase 1:** ยังไม่มีการยืนยันอีเมลตอนสมัคร (`requireEmailVerification: false`) — สมัครแล้วเข้าใช้ได้เลย จะเปิดใช้ใน Phase 1.5 พร้อมงานอีเมลอื่น

### 4.4 `/invite/[token]` — หน้ารับคำเชิญ
- การ์ดกลางจอ: avatar ผู้เชิญ + "**{ชื่อผู้เชิญ}** เชิญคุณเข้าร่วมครอบครัว **{ชื่อ family}**" + role badge ที่จะได้รับ
- ยังไม่ล็อกอิน → ปุ่ม "เข้าสู่ระบบเพื่อรับคำเชิญ" / "สมัครสมาชิก" (กลับมาที่ token เดิมหลังล็อกอิน)
- ล็อกอินแล้ว → ปุ่ม primary "เข้าร่วมครอบครัว" + ghost "ปฏิเสธ"
- **สถานะพิเศษที่ต้องวาด:** ลิงก์หมดอายุ / ถูกใช้ไปแล้ว / อีเมลไม่ตรงกับบัญชีที่ล็อกอินอยู่ → การ์ด warning + ทางออก

---

## 5. Onboarding — `/onboarding`

Wizard 4 ขั้น เต็มจอ ไม่มี bottom nav · **progress dots 4 จุด** บนสุด (active `brown-700`, ผ่านแล้ว `brown-300`, ยังไม่ถึง `cream-200`) · ปุ่ม "ย้อนกลับ" ghost ซ้ายบนตั้งแต่ step 2

| Step | เนื้อหา | Input | ออกไปไหนได้ |
|---|---|---|---|
| **1. ยินดีต้อนรับ** | Illustration + "เริ่มต้นดูแลการตั้งครรภ์ไปด้วยกัน" + bullet 3 ข้อว่าแอปทำอะไรได้ | — | ปุ่ม primary "เริ่มเลย" |
| **2. ตั้งชื่อครอบครัว** | "ตั้งชื่อพื้นที่ของครอบครัวคุณ" | input ชื่อ (default = "ครอบครัว{ชื่อผู้ใช้}") | ถัดไป |
| **3. วันที่ตั้งครรภ์** | **หัวใจของ onboarding** — toggle 2 ทาง: `รู้วันประจำเดือนครั้งสุดท้าย (LMP)` \| `รู้วันคาดคลอด (EDD)` | date picker 1 ช่อง ตามที่เลือก | ถัดไป (validate: ไม่อนาคต, ไม่เกิน 300 วันย้อนหลัง) |
| **4. ยืนยัน** | การ์ดสรุป: อายุครรภ์ปัจจุบัน (Display) / วันคาดคลอด / ไตรมาส + ข้อความ "แก้ไขภายหลังได้ในหน้าโปรไฟล์" | — | ปุ่ม primary "เข้าสู่แอป" → `/dashboard` |

**Logic ที่ designer ต้องรู้:** กรอก LMP → คำนวณ EDD (+280 วัน) · กรอก EDD → ถอยกลับเป็น LMP · step 4 คำนวณสัปดาห์+วันสดจากวันนี้ (`calculateGestationalAge`)

**Skip:** ให้ข้ามได้ที่ step 3 ด้วยลิงก์ Caption "ยังไม่ทราบ ข้ามไปก่อน" → Dashboard จะขึ้นการ์ด setup prompt แทน hero (ดู 6.1)

**ผู้ใช้ที่มาจาก invite ไม่ต้องผ่าน onboarding** — accept invite แล้วเข้า `/dashboard` ของ family นั้นทันที

---

## 6. หน้าหลักของแอป

### 6.1 `/dashboard` — หน้าแรก

จุดสายตาแรกต้องเป็น **เลขสัปดาห์** ตาม design principle ข้อ 2

**Layout blocks (เรียงบนลงล่างบน mobile)**

| # | Block | รายละเอียด |
|---|---|---|
| 1 | **Top bar** | avatar ผู้ใช้ (แตะ→profile) · ชื่อ family กลาง · ไอคอน bell (ถ้ามีนัดใน 24 ชม. → จุด `warning`) |
| 2 | **Hero การ์ดอายุครรภ์** | bg `brown-100` หรือ white + border · เลข **"24"** Display 32px + "สัปดาห์ 3 วัน" · Progress bar 1–40 (track `cream-200`, fill `brown-500`, radius-full) · แถวล่าง 2 ช่อง: `ไตรมาส 2` \| `เหลืออีก 112 วัน` |
| 3 | **Countdown วันคลอด** | อาจรวมใน hero หรือแยกการ์ด — ตัวเลขวันใหญ่ (ตัวหนา 700 ได้ ตาม typography note) + วันที่คาดคลอดเป็น Body Small |
| 4 | **นัดหมายถัดไป** | การ์ดเดียว: วัน-เวลา · ชื่อแพทย์/สถานที่ · badge "อีก 3 วัน" (`warning` ถ้า ≤ 24 ชม.) · แตะ→รายละเอียด · ถ้าไม่มี → แถวเตี้ยๆ "ยังไม่มีนัดหมาย" + ลิงก์เพิ่ม |
| 5 | **บันทึกล่าสุด** | 2–3 รายการล่าสุดแบบย่อ (สัปดาห์ · น้ำหนัก · mood icon) + ลิงก์ "ดูทั้งหมด" · ถ้าไม่มี → prompt "บันทึกสุขภาพสัปดาห์นี้" |
| 6 | **Quick actions** | 2 ปุ่ม secondary เต็มความกว้าง: `+ บันทึกสุขภาพ` · `+ เพิ่มนัดหมาย` — **ซ่อนทั้ง block ถ้า viewer** |

**สถานะพิเศษ:**
- **ยังไม่ตั้ง LMP** (ข้าม onboarding) → block 2–3 แทนที่ด้วยการ์ด prompt bg `cream-100`: "ตั้งค่าวันตั้งครรภ์เพื่อดูอายุครรภ์" + ปุ่ม (owner เท่านั้นที่กดได้; editor/viewer เห็นข้อความ "รอเจ้าของครอบครัวตั้งค่า")
- **เลยกำหนดคลอด** (days < 0) → countdown เปลี่ยนเป็น "เลยกำหนด X วัน" สี `warning` ไม่ใช่ danger
- **สัปดาห์ > 40** → progress bar เต็ม + สีเปลี่ยนเป็น `brown-700`

**Desktop ≥1024px:** block 2+3 กินคอลัมน์ซ้ายเต็ม, block 4+5 ไปคอลัมน์ขวา, quick actions ย้ายไป top bar

---

### 6.2 `/health` — บันทึกสุขภาพ (List)

**Top bar:** "บันทึกสุขภาพ" + ไอคอน filter ขวา

**Filter bar** (แถวเลื่อนแนวนอน, chip `radius-full`): `ทั้งหมด` · `เดือนนี้` · `ไตรมาสนี้` — active chip bg `brown-100` text `brown-900`

**List:** จัดกลุ่มตามเดือน มี sticky section header (Body Small `ink-600`, bg `cream-50`)

**Log Card แต่ละใบ** (radius-md, white, border `cream-200`, padding space-4):
```
┌──────────────────────────────────────────┐
│ สัปดาห์ที่ 24        [mood icon]  12 ส.ค. │  ← H2 + Caption ขวา
│ ─────────────────────────────────────── │
│  ⚖ 62.5 กก.      🩺 118/76               │  ← 2 คอลัมน์ metric
│  [คลื่นไส้] [ปวดหลัง]                     │  ← symptom tags brown-100
│  "วันนี้รู้สึกดีขึ้นมาก..."                  │  ← note 2 บรรทัด truncate
│                          บันทึกโดย แม่หญิง │  ← Caption ink-400
└──────────────────────────────────────────┘
```
- **ค่าผิดปกติ:** ความดัน ≥140/90 → ตัวเลขสี `danger` + ไอคอน AlertCircle เล็ก (แบบหม่น ไม่ใช่แถบแดงทั้งการ์ด ตาม principle ข้อ 3)
- **แตะการ์ด** → ขยาย inline แสดง note เต็ม + ปุ่ม `แก้ไข` / `ลบ` (owner/editor เท่านั้น)
- **Empty state:** "ยังไม่มีบันทึกสุขภาพ — บันทึกน้ำหนัก ความดัน และอาการในแต่ละสัปดาห์ เพื่อดูแนวโน้มและแชร์กับคุณหมอ" + ปุ่ม primary

**FAB** `+` มุมขวาล่าง (ซ่อนถ้า viewer)

---

### 6.3 `/health/new` · `/health/[id]/edit` — ฟอร์มสุขภาพ

Mobile = full-screen page · Desktop = modal · Header: `X` ซ้าย + "บันทึกสุขภาพ" กลาง · **ปุ่มบันทึกตรึงล่าง** เต็มความกว้าง (bg white, border-top `cream-200`)

| ลำดับ | Field | Type | หมายเหตุ |
|---|---|---|---|
| 1 | วันที่บันทึก | date picker | default = วันนี้ |
| 2 | สัปดาห์ที่ | number | **auto-fill จากวันที่** แต่แก้ได้ · แสดงเป็นข้อความช่วย "คำนวณจากวันที่ตั้งครรภ์" |
| 3 | น้ำหนัก (กก.) | number, step 0.1 | suffix "กก." ในช่อง · แสดง delta จากครั้งก่อน "+0.4 จากครั้งที่แล้ว" Caption |
| 4 | ความดันโลหิต | 2 ช่องคู่ `120` / `80` | คั่นด้วย "/" · hint "ตัวบน / ตัวล่าง" · เตือน inline (ไม่บล็อกการบันทึก) ถ้าเกินเกณฑ์ |
| 5 | อาการ | **multi-select chips** | ชุดสำเร็จ: คลื่นไส้, อาเจียน, ปวดหลัง, บวม, เหนื่อยง่าย, นอนไม่หลับ, ท้องผูก, เวียนหัว + ชิป `+ เพิ่มเอง` |
| 6 | อารมณ์ | **5 ปุ่ม icon** เรียงแถว | great / good / okay / tired / bad — ใช้ไอคอนหน้า + label Caption ใต้ไอคอน · เลือกได้ 1 |
| 7 | **รูปภาพ** *(ใหม่)* | photo picker | สูงสุด 10 รูป/บันทึก · thumbnail 104×104 radius 10 + ปุ่มเพิ่มกรอบ dashed · ป้ายประเภทมุมซ้ายล่าง (อัลตราซาวด์ / ครอบครัว) · hint "จะไปรวมอยู่ในอัลบั้มให้อัตโนมัติ" |
| 8 | บันทึกเพิ่มเติม | textarea 4 แถว | placeholder "อาการ ความรู้สึก หรือสิ่งที่อยากบอกคุณหมอ" |

- โหมด edit: มีปุ่ม `ลบบันทึกนี้` (ghost สี danger) ล่างสุดของฟอร์ม
- ทุกช่องยกเว้นวันที่+สัปดาห์เป็น optional → บันทึกได้แม้กรอกแค่ mood
- **ออกจากฟอร์มทั้งที่แก้ค้าง** → confirm dialog "ทิ้งการเปลี่ยนแปลง?"

---

### 6.4 `/appointments` — นัดหมายแพทย์ (List)

**Segmented control บนสุด:** `กำลังจะถึง` (default) | `ผ่านมาแล้ว`

**Appointment Card:**
```
┌──────────────────────────────────────────┐
│ ┌────┐                                   │
│ │ ส.ค│  14:30  ตรวจครรภ์ตามนัด           │  ← วันที่ block ซ้าย + เวลา/หัวข้อ
│ │ 28 │  นพ.สมชาย · รพ.รามาธิบดี          │
│ └────┘  🔔 เตือนก่อน 1 ชม.   [อีก 3 วัน] │  ← badge เวลาเหลือ
└──────────────────────────────────────────┘
```
- **Date block ซ้าย**: bg `brown-100`, radius-sm, เดือนบน/วันล่าง — ถ้าเป็นนัดที่ผ่านแล้ว bg `cream-200` text `ink-400` และการ์ดทั้งใบ opacity 60%
- Badge เวลาเหลือ: > 7 วัน = `cream-200`/ink-600 · ≤ 3 วัน = `warning` · วันนี้ = `brown-700`/white ข้อความ "วันนี้"
- **จัดกลุ่ม** ด้วย sticky header: `วันนี้` / `สัปดาห์นี้` / `เดือนนี้` / `ในอนาคต`
- **Empty:** "ยังไม่มีนัดหมาย — เพิ่มนัดตรวจครรภ์ครั้งถัดไป แล้วเราจะเตือนคุณล่วงหน้า"
- **Banner ขออนุญาต Notification:** แถบ bg `cream-100` เหนือ list ครั้งแรกที่เข้าหน้านี้ "เปิดการแจ้งเตือนเพื่อไม่พลาดนัดหมาย" + ปุ่ม `เปิด` / `X` ปิด (จำสถานะไว้)

---

### 6.5 `/appointments/new` · `/[id]/edit` — ฟอร์มนัดหมาย

| ลำดับ | Field | Type | หมายเหตุ |
|---|---|---|---|
| 1 | วันที่ | date picker | ไม่ให้เลือกอดีต (โหมด edit ให้ได้) |
| 2 | เวลา | time picker | step 15 นาที |
| 3 | หัวข้อนัด | text + **chip แนะนำ** | "ตรวจครรภ์ตามนัด", "อัลตราซาวด์", "ตรวจเลือด", "ฉีดวัคซีน" |
| 4 | แพทย์ | text | placeholder "นพ./พญ. ..." |
| 5 | สถานที่ | text | *(ต้องเพิ่ม column `location` ใน DB — ดูหัวข้อ 10)* |
| 6 | **การแจ้งเตือน** | toggle switch | เปิด default |
| 7 | เตือนล่วงหน้า | select (แสดงเมื่อ toggle เปิด) | 30 นาที / 1 ชม. / 3 ชม. / 1 วัน / 2 วัน — default 1 ชม. |
| 8 | บันทึก | textarea 3 แถว | "สิ่งที่ต้องเตรียม หรือคำถามที่อยากถามคุณหมอ" |

---

### 6.6 `/family` — จัดการครอบครัว

**Block 1 — การ์ดครอบครัว:** ชื่อ family (H1) + "สมาชิก 3 คน" + ไอคอน edit (owner เท่านั้น)

**Block 2 — รายชื่อสมาชิก** (section header "สมาชิก")
```
┌──────────────────────────────────────────┐
│ (AV)  แม่หญิง  (คุณ)              [owner]│  ← avatar + ชื่อ + badge role
│       yaya@email.com                  ⋮  │  ← อีเมล Caption + เมนู
└──────────────────────────────────────────┘
```
- **Role badge** ตาม design-system §4: owner = `brown-100`/`brown-900` · editor = `cream-200`/`ink-900` · viewer = `cream-100`/`ink-600` — ใส่ label ไทยกำกับ: `เจ้าของ` / `แก้ไขได้` / `ดูอย่างเดียว`
- ตัวเองมีป้าย "(คุณ)" ต่อท้ายชื่อ
- **เมนู ⋮ แสดงเฉพาะ owner และไม่แสดงบนแถวของตัวเอง** → `เปลี่ยนสิทธิ์` (bottom sheet เลือก editor/viewer พร้อมคำอธิบายว่าทำอะไรได้) · `นำออกจากครอบครัว` (danger + confirm)

**Block 3 — คำเชิญที่รอตอบรับ** (แสดงเมื่อมี pending, owner เท่านั้น)
- แถวละ: อีเมลที่เชิญ + role ที่จะได้ + "หมดอายุใน 5 วัน" (Caption) + ปุ่ม `คัดลอกลิงก์` / `ยกเลิก`
- เกินกำหนด → badge `หมดอายุ` สี ink-400 + ปุ่ม `เชิญใหม่`

**Block 4 — ปุ่ม `+ เชิญสมาชิก`** primary เต็มความกว้าง — **owner เท่านั้น**

**Block 5 — Danger zone** (owner): ghost danger `ลบครอบครัวนี้` + confirm ที่ต้องพิมพ์ชื่อ family ยืนยัน

**สิ่งที่ non-owner เห็น:** block 1 (ไม่มี edit) + block 2 (ไม่มีเมนู ⋮) เท่านั้น + ลิงก์ ghost `ออกจากครอบครัวนี้` ล่างสุด

---

### 6.7 `/family/invite` — เชิญสมาชิก

Bottom sheet (mobile) / modal (desktop) 2 ขั้นในหน้าเดียว:

**ขั้นที่ 1 — กรอกข้อมูล**
- input อีเมลผู้ถูกเชิญ
- เลือก role: **การ์ดเลือก 2 ใบ** (ไม่ใช้ dropdown) — แต่ละใบมีชื่อ role + คำอธิบายว่าทำอะไรได้/ไม่ได้
  - `แก้ไขได้ (editor)` — "เพิ่มและแก้ไขบันทึกสุขภาพ นัดหมายได้ แต่แก้วันตั้งครรภ์และเชิญสมาชิกไม่ได้"
  - `ดูอย่างเดียว (viewer)` — "ดูข้อมูลทั้งหมดได้ แต่แก้ไขอะไรไม่ได้"
- ปุ่ม primary "สร้างลิงก์เชิญ"

**ขั้นที่ 2 — ลิงก์เชิญ (MVP ไม่ส่งอีเมลอัตโนมัติ)**
- กล่องลิงก์ bg `cream-100`, radius-sm, truncate + ปุ่ม `คัดลอก` (เปลี่ยนเป็น ✓ คัดลอกแล้ว 2 วิ)
- ปุ่มแชร์ผ่านระบบ (Web Share API) สำหรับ mobile
- ข้อความ Caption "ลิงก์นี้ใช้ได้ 7 วัน และใช้ได้ครั้งเดียว"
- ปุ่ม ghost "เชิญคนอื่นอีก" (กลับขั้น 1)

> **จุดที่ต้องบอก designer ชัดๆ:** ขั้นที่ 2 คือของจริงใน MVP — owner ต้องคัดลอกลิงก์ไปส่งเอง (LINE/แชท) ระบบไม่ส่งอีเมล ต้องออกแบบให้ผู้ใช้เข้าใจข้อนี้โดยไม่รู้สึกว่าแอปพัง

---

### 6.8 `/profile` — โปรไฟล์และตั้งค่า

รายการแบบ grouped list (bg `cream-50`, การ์ดขาวคั่นกลุ่ม):

1. **การ์ดผู้ใช้** — **avatar อัปโหลดรูปได้** (มีปุ่มกล้องมุมขวาล่าง) + ชื่อ + อีเมล + badge role + ปุ่ม `แก้ไขโปรไฟล์` → `/profile/edit`
1b. **ครอบครัว** *(ใหม่ — ย้ายมาจาก bottom nav)* — การ์ดแถวเดียว: ไอคอน + ชื่อ family + "สมาชิก 3 คน · คุณเป็นเจ้าของ" + ลูกศร → `/family`
2. **การตั้งครรภ์** → `/profile/pregnancy` — แสดง LMP / วันคาดคลอด / สถานะ · **owner เท่านั้นที่แตะเข้าไปแก้ได้** (คนอื่นเห็นเป็นข้อมูล read-only ไม่มีลูกศร >)
3. **การแจ้งเตือน** — toggle "แจ้งเตือนนัดหมาย" + สถานะสิทธิ์ browser (ถ้าถูกบล็อก → ข้อความ warning + วิธีเปิดใน setting เบราว์เซอร์)
4. **บัญชี** — เปลี่ยนรหัสผ่าน (เฉพาะบัญชี email) · บัญชีที่เชื่อมต่อ (Google / อีเมล)
5. **อื่นๆ** — ภาษา (ไทย/EN, Phase 2) · เกี่ยวกับแอป · นโยบายความเป็นส่วนตัว
6. **`ออกจากระบบ`** ghost danger ล่างสุด

**`/profile/pregnancy`** (owner only): แก้ LMP หรือ EDD (toggle เหมือน onboarding step 3) + preview อายุครรภ์ใหม่ก่อนบันทึก + คำเตือนว่าจะกระทบการคำนวณย้อนหลังของบันทึกเดิม

---

### 6.9 `/album` · `/album/[id]` — อัลบั้มรูป *(Phase 2)*

> ออกแบบไว้ล่วงหน้าแล้วเพื่อให้ bottom nav และฟอร์มสุขภาพวางโครงถูกตั้งแต่ Phase 1 แต่ **ลงมือทำใน Phase 2** พร้อมกับ R2

**`/album` — กริดรูป**
1. **Top bar** — "อัลบั้ม" + ไอคอนกล้องขวา (เพิ่มรูป)
2. **Filter chips** — `ทั้งหมด` · `อัลตราซาวด์` · `ครอบครัว` · `อื่นๆ`
3. **การ์ดสรุป 2 ใบ** — จำนวนรูปทั้งหมด / จำนวนครั้งที่อัลตราซาวด์ (ตัวเลขอัลตราซาวด์ใช้สี `clay-500`)
4. **กริด 3 คอลัมน์** จัดกลุ่มด้วย sticky header ตามสัปดาห์ — "สัปดาห์ที่ 24 · สิงหาคม 2569"
5. **FAB** เพิ่มรูป — ซ่อนถ้า viewer

**`/album/[id]` — ดูรูป**
- พื้นหลังเข้ม `ink-900` · รูปเต็มกลางจอ · top bar `X` + `⋮`
- **แผ่นข้อมูลล่าง** (radius-lg บนพื้น `cream-50`): สัปดาห์ที่ + badge ประเภท + วันที่/ผู้เพิ่ม + คำบรรยาย
- **แถวแชร์** — 3 ปุ่ม `แชร์ลิงก์` / `ส่งให้ครอบครัว` / `บันทึกรูป` **แสดงเป็น disabled (opacity 55%) พร้อม badge `เร็วๆ นี้ · Phase 3`**

> **จุดที่ต้องตัดสินใจตอนทำจริง:** รูปเก็บที่ **Cloudflare R2** (free tier 10 GB) — เดิมเลื่อนไป Phase 2 อยู่แล้ว ตอนนี้กลับเข้ามาเป็นงานหลักของ Phase 2 · ต้อง resize ฝั่ง client ก่อนอัปโหลด และเก็บ thumbnail แยกเพื่อไม่ให้กริดโหลดช้า

---

## 7. Role → UI Matrix (ต้องออกแบบทุกช่องนี้)

หลักการ design-system ข้อ 5: **viewer ต้องไม่เห็นปุ่มแก้ไขเลย ไม่ใช่ disabled** — ตารางนี้คือสิ่งที่ designer ต้องส่งมอบ (อย่างน้อยต้องมี mockup ของ viewer สำหรับ Dashboard, Health list, Family)

| หน้าจอ | องค์ประกอบ | owner | editor | viewer |
|---|---|:---:|:---:|:---:|
| Dashboard | Quick actions block | ✅ | ✅ | **ซ่อน** |
| Dashboard | การ์ด prompt ตั้งค่า LMP | ปุ่มกดได้ | ข้อความ read-only | ข้อความ read-only |
| Health list | FAB `+` | ✅ | ✅ | **ซ่อน** |
| Health card | ปุ่ม แก้ไข/ลบ (เมื่อขยาย) | ✅ | ✅ | **ซ่อน** |
| Health empty state | ปุ่ม primary ใน empty | ✅ | ✅ | **ซ่อน** (เหลือแค่ข้อความ "ยังไม่มีบันทึก") |
| Appointments | FAB + ปุ่มแก้ไข/ลบ | ✅ | ✅ | **ซ่อน** |
| Family | เมนู ⋮ ต่อสมาชิก | ✅ | **ซ่อน** | **ซ่อน** |
| Family | ปุ่ม `+ เชิญสมาชิก` | ✅ | **ซ่อน** | **ซ่อน** |
| Family | block คำเชิญที่รอตอบรับ | ✅ | **ซ่อน** | **ซ่อน** |
| Family | Danger zone (ลบครอบครัว) | ✅ | **ซ่อน** | **ซ่อน** |
| Family | ลิงก์ `ออกจากครอบครัวนี้` | **ซ่อน** | ✅ | ✅ |
| Profile | แถว "การตั้งครรภ์" มีลูกศร > | ✅ | read-only | read-only |
| Profile | แถว "ครอบครัว" (ทางเข้า `/family`) | ✅ | ✅ | ✅ |
| Album | FAB เพิ่มรูป *(Phase 2)* | ✅ | ✅ | **ซ่อน** |
| Album | เมนู ⋮ ลบรูปในหน้าดูรูป *(Phase 2)* | ✅ | ✅ | **ซ่อน** |

**ป้ายบอกสิทธิ์:** ผู้ใช้ role viewer ควรเห็น badge `ดูอย่างเดียว` ที่การ์ดโปรไฟล์ใน `/profile` และ (ถ้าออกแบบไหว) แถบบางๆ ใต้ top bar ของ Dashboard ครั้งแรกที่เข้าใช้ เพื่อไม่ให้สงสัยว่าทำไมไม่มีปุ่มเพิ่ม

---

## 8. Key Flows

### 8.1 Flow แรกเข้า
```
เปิดแอป → มี session?
  ├─ ไม่มี ───────────────→ /login
  └─ มี ─→ มี active_family_id?
            ├─ ไม่มี ──────→ /onboarding
            └─ มี ─────────→ /dashboard
```

### 8.2 Flow สมัคร → ใช้งานครั้งแรก
```
/signup → ชื่อ + อีเมล + รหัสผ่าน  (หรือกด Google ข้ามฟอร์มไปเลย)
   → สร้าง user → /onboarding (4 ขั้น) → สร้าง family + pregnancy_profile
   → /dashboard (มี hero อายุครรภ์ทันที)
```
> **session อยู่ได้ 60 วัน + rolling refresh** — ปิดแท็บแล้วเปิดใหม่ยังล็อกอินอยู่ ไม่ต้องกรอกรหัสผ่านซ้ำ

### 8.3 Flow เชิญสมาชิก (MVP — copy link)
```
[owner] /family → + เชิญสมาชิก → กรอกอีเมล + เลือก role → สร้างลิงก์
   → คัดลอกลิงก์ → ส่งเองผ่าน LINE/แชท
[ผู้ถูกเชิญ] เปิดลิงก์ /invite/[token]
   ├─ ยังไม่มีบัญชี → /signup (จำ token) → กลับ /invite/[token]
   └─ มีบัญชีแล้ว → /login → กลับ /invite/[token]
   → กด "เข้าร่วมครอบครัว" → set active_family_id → /dashboard (ข้าม onboarding)
```

### 8.4 Flow แจ้งเตือนนัดหมาย
```
เข้า /appointments ครั้งแรก → banner ขอสิทธิ์ Notification
   → อนุญาต → ตั้ง reminder ในฟอร์มนัดหมายได้เต็มรูปแบบ
   → ปฏิเสธ/บล็อก → ฟอร์มยังตั้งค่าได้ แต่มี hint สี warning
      "การแจ้งเตือนถูกปิดในเบราว์เซอร์ — ตั้งค่าจะบันทึกไว้แต่ยังไม่แจ้งเตือน"
```
> **ข้อจำกัดที่ต้องสื่อสารในดีไซน์:** Browser Notification ทำงานได้เมื่อเปิดแอปค้างไว้เท่านั้น ถ้าปิดแท็บจะไม่เตือน — ควรมีข้อความอธิบายสั้นๆ ในหน้าตั้งค่าการแจ้งเตือน (แก้จริงต้องใช้ Web Push + Service Worker, Phase 2)

---

## 9. Shared Component Inventory

ให้ออกแบบเป็น component library ก่อนลงหน้าจอจริง — ทุกตัวมี spec ฐานอยู่ใน design-system.md แล้ว

| กลุ่ม | Component | Variants / States |
|---|---|---|
| **Navigation** | BottomNav · Sidebar · TopAppBar · FAB | active / inactive · with-badge |
| **Action** | Button | primary / secondary / ghost / danger × default / hover / pressed / disabled / loading |
| **Container** | Card · SectionHeader (sticky) · BottomSheet · Modal · Toast | — |
| **Form** | TextInput · NumberInput (มี suffix) · Textarea · DatePicker · TimePicker · Select · Toggle · Checkbox · **ChipMultiSelect** · **MoodPicker (5 ไอคอน)** · **BPInput (คู่ 120/80)** | default / focus / filled / error / disabled |
| **Data display** | RoleBadge (3 สี) · StatusBadge (เวลาเหลือ 4 ระดับ) · **GestationProgressBar** · DateBlock (นัดหมาย) · MetricRow · SymptomTag · Avatar (+ AvatarGroup) | — |
| **Feedback** | EmptyState (× 4 หน้า) · ErrorCard · Skeleton (card/list/hero) · ConfirmDialog | — |
| **Auth** | GoogleButton · PasswordStrengthMeter · PasswordToggle (ปุ่มตา) | — |
| **Photo** *(ใหม่)* | **PhotoTile** (มี badge ประเภท) · **AddPhotoButton** (กรอบ dashed) · **AvatarUpload** (ปุ่มกล้อง) · PhotoGrid · PhotoViewer | placeholder / มีรูป / กำลังอัปโหลด |

**นับหน้าจอที่ต้องวาด:** 18 routes × (default + empty/error ที่จำเป็น) + viewer variant 3 หน้า ≈ **28–32 artboards** — วาดไปแล้ว **20 หน้าจอ + component library**

---

## 10. สถานะการตัดสินใจ

ทุกข้อปิดแล้ว — เหลือแค่งานที่ต้องเคลียร์ก่อน coding (ดู [project-plan.md](./project-plan.md))

| # | ประเด็น | สรุป |
|---|---|---|
| 1 | ช่องทาง login | ✅ **Google OAuth + อีเมล/รหัสผ่าน** · อีเมลคือ username |
| 2 | Email OTP | ⏭ **เลื่อนไป Phase 1.5** พร้อมงานอีเมลทั้งก้อน — Phase 1 จึงไม่ต้องมี email service, domain หรือค่าใช้จ่ายใดๆ |
| 3 | ลืมรหัสผ่าน | ⏭ Phase 1.5 · Phase 1 ใช้ข้อความชี้ทางไป Google login แทน (§4.1) |
| 4 | จำ user ไว้ | ✅ session **60 วัน** + rolling refresh — ปิดแท็บแล้วเปิดใหม่ยังล็อกอินอยู่ |
| 5 | Dark mode | ✅ **ไม่ทำ** — ตัดออกจาก Phase 1 ทั้งฝั่ง design และ code |
| 5b | ชื่อผลิตภัณฑ์ | ✅ **Health Care** = web app · **Pre Care** = ฟีเจอร์ตั้งครรภ์ (ฟีเจอร์แรก) |
| 5c | Bottom nav | ✅ `ครอบครัว` ย้ายเข้าโปรไฟล์ · เอา **`อัลบั้ม`** มาแทนที่ (ทำจริง Phase 2) |
| 5d | รูปภาพ | ✅ อัปโหลดรูปโปรไฟล์ + แนบรูปในบันทึกสุขภาพ + อัลบั้ม — **ทั้งชุดอยู่ Phase 2** เพราะต้องมี R2 · ปุ่มแชร์ social = Phase 3 |
| 6 | Hosting | ✅ **Cloudflare Workers + OpenNext** (ไม่ใช่ Pages — `next-on-pages` ถูก deprecate แล้ว) · เริ่มบน `*.workers.dev` ฟรี |
| 7 | Auth library | ✅ **Better Auth** แทน Auth.js — มี email+password ในตัว และเติม `emailOTP` plugin ใน Phase 1.5 ได้โดยไม่ต้องเขียนใหม่ |
| 8 | ภาษา | ✅ ไทยอย่างเดียวใน Phase 1 |

### งานที่ต้องเคลียร์ก่อน coding (ไม่กระทบ design)

- **สคีมา** — เพิ่ม `appointments.location` และ `users.avatar_url` · ตัด `password_hash` (Better Auth เก็บใน `account` เอง) · คง `users.email UNIQUE` เป็น identifier
- **โค้ดใน zip** — `src/types/index.ts` ยังเป็นโครง per-user + Firebase ไม่มีแนวคิด family ต้องเขียนใหม่ทั้งไฟล์ · `package.json` ยังมี `firebase` ต้องถอด · **`src/lib/pregnancy.ts` ใช้ต่อได้ทั้งไฟล์**
- **architecture.md** — หัวข้อ 0 และ 2 ยังเขียน Pages + Auth.js ต้องอัปเดตก่อนเริ่ม

## 11. ลำดับการทำ design (แนะนำ)

1. **Component library** — Button, Card, Input, Badge, BottomNav ก่อน (ปลดล็อกทุกหน้า)
2. **Dashboard** — หน้าที่กำหนดหน้าตาแบรนด์ทั้งแอป ทำก่อนหน้าอื่น
3. **Health list + form** — pattern ของ list/form ที่ Appointments จะยืมไปใช้ต่อ
4. **Appointments list + form** — ปรับจาก 3
5. **Family + invite** — role badge, permission variants
6. **Auth + Onboarding** — ทำท้ายสุดได้ เพราะ pattern น้อยและไม่ผูกกับหน้าอื่น
7. **Viewer variants + empty/error states** — กวาดเก็บทีเดียวตอนท้าย
