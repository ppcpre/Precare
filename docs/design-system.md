# Health Care — Design System

> **ชื่อเรียก:** **Health Care** = ตัว web app · **Pre Care** = ฟีเจอร์บันทึกการตั้งครรภ์ (ฟีเจอร์แรกที่ทำ) — จะมีฟีเจอร์อื่นตามมาภายใต้ Health Care เดียวกัน

> ใช้เอกสารนี้เป็น reference ตอนออกแบบหน้าจอ (Claude design) และตอน coding (Codex) เพื่อให้ UI สอดคล้องกันทั้งแอป
> Concept: **"อบอุ่น สะอาด ไว้ใจได้"** — โทนครีม/น้ำตาล/ขาว สไตล์มินิมอลทันสมัย เหมาะกับแอปสุขภาพแม่และเด็ก

---

## 1. Color Palette

### Primary — โทนน้ำตาล (Brown/Tan)
ใช้กับ CTA หลัก, header, accent สำคัญ — ให้ความรู้สึกอบอุ่น ไว้ใจได้ ไม่ใช้สีชมพู/ม่วงแบบ baby app ทั่วไป

| Token | Hex | การใช้งาน |
|---|---|---|
| `brown-900` | `#3E2C23` | ข้อความหัวข้อสำคัญ, ปุ่ม hover state |
| `brown-700` | `#6B4F3F` | ปุ่มหลัก (primary button), ไอคอน active |
| `brown-500` | `#9C7A5B` | Accent, border เน้น, ลิงก์ |
| `brown-300` | `#C9AD8F` | Badge, tag, disabled state |
| `brown-100` | `#EDE0D1` | Background การ์ดที่ต้องการเน้นเบาๆ |

### Neutral — โทนครีม/ขาว (Base)
ใช้เป็นพื้นหลังหลักของแอปทั้งหมด

| Token | Hex | การใช้งาน |
|---|---|---|
| `cream-50` | `#FDFBF7` | Background หลักของหน้า (page background) |
| `cream-100` | `#F7F1E8` | Background section รอง, sidebar |
| `cream-200` | `#EFE6D8` | Divider, border เบาๆ |
| `cream-300` | `#E5D9C6` | Divider ที่ต้องการเน้นกว่าปกติ, border การ์ดบนพื้นครีม |
| `white` | `#FFFFFF` | Background การ์ด (card), modal |
| `ink-900` | `#2B2420` | ข้อความหลัก (body text) |
| `ink-600` | `#6B6259` | ข้อความรอง (secondary text) |
| `ink-400` | `#A8A099` | Placeholder, disabled text |

### Semantic — สถานะ (ใช้เท่าที่จำเป็น ไม่ให้กลบโทนหลัก)

| Token | Hex | การใช้งาน |
|---|---|---|
| `success` | `#7A9B76` | บันทึกสำเร็จ, สถานะปกติ (เขียวหม่น ไม่ฉูดฉาด) |
| `warning` | `#D4A24C` | แจ้งเตือน เช่น ใกล้ถึงนัดหมาย |
| `danger` | `#B85C4F` | ค่าผิดปกติ (เช่น ความดันสูง), ปุ่มลบ |
| `info` | `#7B93A8` | Tooltip, ข้อมูลเสริม |

### Feature Accent — สีประจำฟีเจอร์

Health Care จะมีหลายฟีเจอร์ สีชุดนี้ใช้**ระบุว่าอยู่ฟีเจอร์ไหน** ทุกตัวคุมความสว่างและความอิ่มสีให้อยู่ระดับเดียวกับ `brown-500` จึงวางข้างกันแล้วไม่ตีกัน

| Token | Hex | ใช้กับฟีเจอร์ |
|---|---|---|
| `clay-500` / `clay-100` | `#B98A72` / `#F3E4DA` | **Pre Care** — ตั้งครรภ์ (คู่สีกับ brown ได้ดีที่สุด) |
| `sage-500` / `sage-100` | `#8AA383` / `#E5EBE2` | โภชนาการ / สุขภาพทั่วไป *(อนาคต)* |
| `sky-500` / `sky-100` | `#8AA3B8` / `#E3EAF0` | เอกสาร / ผลตรวจ *(อนาคต)* |
| `plum-500` / `plum-100` | `#A38C9C` / `#EEE6EC` | อัลบั้ม / ความทรงจำ *(Phase 2)* |

> **ข้อห้ามสำคัญ:** accent ชุดนี้ใช้ได้แค่ **จุดสีเล็กๆ ข้างชื่อฟีเจอร์, ไอคอนหมวด, ตัวเลขสรุป** เท่านั้น — **ห้ามใช้เป็นสีปุ่มหลัก** ปุ่มหลักยังเป็น `brown-700` ทั้งแอป ไม่งั้นจะเสียหลักการ "พื้นหลัง 90% เป็น cream/white" ที่เป็นหัวใจของงานนี้

> **หลักการใช้สี:** พื้นหลัง 90% ใช้ cream/white เท่านั้น สี brown ใช้เฉพาะจุดที่ต้องการดึงความสนใจ (ปุ่ม, ไอคอน, หัวข้อ) semantic color ใช้แบบ muted/หม่น ไม่ใช่สีสดจัดแบบ alert ทั่วไป เพื่อคงความรู้สึก minimal

---

## 2. Typography

**Font:** Noto Sans Thai (รองรับภาษาไทยสวยงาม อ่านง่าย, ฟรี, โหลดผ่าน Google Fonts หรือ self-host)
Fallback: `ui-sans-serif, system-ui, sans-serif`

| Style | Size / Line-height | Weight | ใช้กับ |
|---|---|---|---|
| Display | 32px / 40px | 600 (SemiBold) | หัวข้อหน้า Dashboard เช่น "สัปดาห์ที่ 24" |
| H1 | 24px / 32px | 600 | หัวข้อหน้า (page title) |
| H2 | 20px / 28px | 600 | หัวข้อ section ในการ์ด |
| Body | 16px / 24px | 400 (Regular) | เนื้อหาทั่วไป |
| Body Small | 14px / 20px | 400 | คำอธิบายรอง, label form |
| Caption | 12px / 16px | 400 | timestamp, hint text |
| Button | 16px / 24px | 500 (Medium) | ข้อความบนปุ่ม |

**หลักการ:** ใช้ font-weight ไม่เกิน 3 ระดับ (400/500/600) เพื่อความมินิมอล ไม่ใช้ตัวหนามาก (700+) ยกเว้นตัวเลขสำคัญมากๆ เช่น countdown วันคลอด

---

## 3. Spacing & Layout

ใช้ scale ฐาน 4px (สอดคล้อง Tailwind default)

| Token | Value | ใช้กับ |
|---|---|---|
| `space-1` | 4px | gap ระหว่าง icon กับ text |
| `space-2` | 8px | padding ปุ่มเล็ก, gap ใน form |
| `space-4` | 16px | padding การ์ด (มาตรฐาน) |
| `space-6` | 24px | gap ระหว่าง section |
| `space-8` | 32px | margin บน/ล่าง section หลัก |
| `space-12` | 48px | padding หน้า (page container) บน desktop |

**Border radius:** ใช้มุมมนแบบ soft ไม่ full-round (ยกเว้นปุ่ม icon กลม/avatar)
- `radius-sm` = 8px (input, tag)
- `radius-md` = 12px (การ์ดทั่วไป) ← **ค่ามาตรฐานของแอป**
- `radius-lg` = 16px (การ์ดใหญ่, modal)
- `radius-full` = 9999px (avatar, badge กลม, ปุ่ม icon)

**Shadow:** ใช้เบามาก เน้นความ clean
- `shadow-card`: `0 1px 3px rgba(43,36,32,0.06), 0 1px 2px rgba(43,36,32,0.04)`
- `shadow-modal`: `0 8px 24px rgba(43,36,32,0.12)`

---

## 4. Component Spec (หลัก)

### Button
| Variant | Background | Text | Border |
|---|---|---|---|
| Primary | `brown-700` | `white` | none — hover: `brown-900` |
| Secondary | `white` | `brown-700` | 1px `brown-300` |
| Ghost | transparent | `brown-700` | none, hover bg `cream-100` |
| Danger | `danger` | `white` | none |

ขนาด: height 44px (touch-friendly บนมือถือ), padding แนวนอน 20px, radius `radius-md`

### Card
- Background: `white`
- Border: 1px `cream-200`
- Radius: `radius-md`
- Padding: `space-4`
- Shadow: `shadow-card`

### Input / Form Field
- Background: `cream-50`
- Border: 1px `cream-200`, focus: 1.5px `brown-500`
- Radius: `radius-sm`
- Height: 44px
- Label: Body Small, `ink-600`, วางด้านบน input

### Badge (Role: owner/editor/viewer)
- `owner` → bg `brown-100`, text `brown-900`
- `editor` → bg `cream-200`, text `ink-900`
- `viewer` → bg `cream-100`, text `ink-600`
- Radius: `radius-full`, padding 4px 12px, font: Caption weight 500

### Photo / Avatar (ใหม่)

**Photo tile** — ใช้ในอัลบั้มและในฟอร์มสุขภาพ
- Radius `radius-sm` (8px) สำหรับ thumbnail เล็ก, 10px สำหรับ tile ในอัลบั้ม
- ป้ายประเภทมุมซ้ายล่าง: bg `rgba(43,36,32,0.62)` text ขาว Caption 10px radius-full
- **ระหว่างที่ยังไม่มีภาพจริง** ใช้ placeholder: อัลตราซาวด์ = พื้น `#41372F` ไอคอนรูป `#8A7663` · ภาพทั่วไป = พื้น `cream-100` ไอคอน `brown-300`

**ปุ่มเพิ่มรูป** — กรอบ dashed 1.5px `brown-300` บนพื้น `cream-50` + ไอคอนกล้อง `brown-500` + label Caption

**Avatar อัปโหลดได้** — วงกลม `radius-full` พื้น `cream-100` border 1px `cream-200` · ปุ่มกล้องมุมขวาล่าง 28px พื้น `brown-700` ไอคอนขาว border 2px `white`

### Progress Indicator (อายุครรภ์ 1-40 สัปดาห์)
- แถบ progress bar โค้งมน (radius-full), track สี `cream-200`, fill สี `brown-500`
- แสดงตัวเลขสัปดาห์ปัจจุบันเด่นด้วย Display style ตรงกลางหรือด้านบนแถบ

### Bottom Navigation (Mobile-first)
เนื่องจากเป็นแอปที่ใช้บนมือถือเป็นหลัก แนะนำ bottom nav แทน sidebar:
- Background: `white`, border-top 1px `cream-200`
- Icon + label ขนาดเล็ก (Caption)
- Active state: icon/text เปลี่ยนเป็น `brown-700` + จุดเล็กด้านบนหรือ background pill `brown-100`
- รายการ: หน้าแรก (Dashboard) / สุขภาพ / นัดหมาย / **อัลบั้ม** / โปรไฟล์
- **ครอบครัวไม่อยู่ใน bottom nav แล้ว** — ย้ายไปเป็นแถวในหน้าโปรไฟล์ เพราะเป็นงานที่ทำนานๆ ครั้ง ส่วนอัลบั้มเป็นของที่เปิดดูบ่อยกว่า

---

## 5. Iconography & Imagery

- **Icon set:** เส้น (outline/stroke) น้ำหนักเส้นสม่ำเสมอ 1.5-2px ไม่ใช้ filled icon เว้นแต่ active state — แนะนำ `lucide-react` (มีให้ใช้ในระบบอยู่แล้ว)
- **สีไอคอน default:** `ink-600`, active/selected: `brown-700`
- **ภาพประกอบ (ถ้ามี):** ใช้ illustration แบบ flat/organic เส้นนุ่ม โทนสีเดียวกับ palette ข้างต้น หลีกเลี่ยงภาพถ่ายจริงของคนในหน้า onboarding เพื่อความเป็นมิตรและเป็นกลาง (ไม่ระบุเชื้อชาติ/ลักษณะเฉพาะ)

---

## 6. Tailwind Config Token (สำหรับ coding ภายหลัง)

```js
// tailwind.config อ้างอิง — เพิ่มใน theme.extend เมื่อเริ่ม coding
colors: {
  brown: {
    100: '#EDE0D1',
    300: '#C9AD8F',
    500: '#9C7A5B',
    700: '#6B4F3F',
    900: '#3E2C23',
  },
  cream: {
    50: '#FDFBF7',
    100: '#F7F1E8',
    200: '#EFE6D8',
  },
  ink: {
    400: '#A8A099',
    600: '#6B6259',
    900: '#2B2420',
  },
  success: '#7A9B76',
  warning: '#D4A24C',
  danger: '#B85C4F',
  info: '#7B93A8',
},
borderRadius: {
  sm: '8px',
  md: '12px',
  lg: '16px',
}
```

---

## 7. หลักการออกแบบโดยรวม (Design Principles)

1. **Whitespace ก่อนสี** — เว้นพื้นที่ว่างให้พอ อย่าเบียดข้อมูล แม้จะมีฟีเจอร์เยอะ (สุขภาพ, นัดหมาย, ครอบครัว)
2. **ข้อมูลสำคัญ = ใหญ่และชัด** — เลขสัปดาห์ตั้งครรภ์, countdown วันคลอด ควรเป็นจุดสายตาแรกของ Dashboard
3. **ไม่ใช้สีสดแทน severity เกินจำเป็น** — ค่าความดันผิดปกติใช้ `danger` แบบหม่น ไม่ใช่สีแดงจัดที่ทำให้ตกใจเกินเหตุ
4. **Mobile-first เสมอ** — ทุก component ออกแบบให้ touch target ≥ 44px และทดสอบบนจอแคบก่อน
5. **Role ต้อง visible ชัดเจน** — หน้าที่ viewer เข้าดู ต้องไม่มีปุ่มแก้ไขให้เห็นเลย (ไม่ใช่แค่ disabled) เพื่อลดความสับสน
