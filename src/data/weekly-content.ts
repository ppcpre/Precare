/**
 * เนื้อหารายสัปดาห์ 4–40 สำหรับการ์ด "ขนาดของลูกน้อย" และ "พัฒนาการของหนูน้อย"
 *
 * เก็บเป็น static ในโค้ด ไม่เข้า D1 — เป็นข้อมูลคงที่ 37 แถว ไม่มีใครแก้
 * ประหยัดทั้ง row read และ latency ต่อการเปิดหน้าแรกหนึ่งครั้ง
 *
 * ที่มา (ดูฉบับเต็มพร้อมลิงก์ใน docs/pregnancy-weekly-data.md)
 * - ขนาด/น้ำหนัก: Fetal Growth Chart, Utah Department of Health
 * - พัฒนาการ: Cleveland Clinic
 * - การเทียบผลไม้: แปลงจากต้นฉบับฝรั่ง (poppy seed, rutabaga, jicama)
 *   เป็นผลไม้/ผักที่คนไทยเห็นภาพออก ขนาดใกล้เคียงของเดิม
 *
 * ⚠️ ตัวเลขเป็นค่าเฉลี่ย ไม่ใช่คำแนะนำทางการแพทย์
 *    ทุกที่ที่แสดงข้อมูลชุดนี้ต้องมี DISCLAIMER กำกับเสมอ
 *
 * ⚠️ สัปดาห์ 4–7 ไม่มีตัวเลข เพราะเล็กเกินกว่าจะวัดเป็นมาตรฐานได้ (เป็น null)
 *    UI ต้องรองรับ ไม่ใช่แสดง "null ซม."
 */
export interface WeeklyContent {
  week: number;
  trimester: 1 | 2 | 3;
  /** null ในสัปดาห์ 4–7 */
  lengthCm: number | null;
  weightG: number | null;
  /**
   * วิธีวัดเปลี่ยนที่สัปดาห์ 21 — จากหัวถึงก้น เป็นหัวถึงส้นเท้า
   * ตัวเลขจึงกระโดดจาก 16.4 เป็น 26.7 ซม. ในสัปดาห์เดียว
   * ต้องอธิบายใน UI ไม่งั้นผู้ใช้ตกใจว่าลูกโตขึ้น 10 ซม. ในเจ็ดวัน
   */
  measure: "crown-rump" | "crown-heel";
  size: string;
  development: string;
}

export const DISCLAIMER =
  "เป็นค่าเฉลี่ยเพื่อการอ้างอิงเท่านั้น ขนาดของลูกน้อยแต่ละคนต่างกันได้ กรุณาปรึกษาแพทย์";

export const MIN_WEEK = 4;
export const MAX_WEEK = 40;

export const WEEKLY_CONTENT: readonly WeeklyContent[] = [
  { week: 4, trimester: 1, lengthCm: null, weightG: null, measure: "crown-rump", size: "เมล็ดงาดำ", development: "ตัวอ่อนฝังตัวที่ผนังมดลูก ถุงน้ำคร่ำเริ่มก่อตัว" },
  { week: 5, trimester: 1, lengthCm: null, weightG: null, measure: "crown-rump", size: "เมล็ดงา", development: "ท่อประสาทเริ่มสร้าง หัวใจเริ่มเต้นราว 110 ครั้ง/นาที" },
  { week: 6, trimester: 1, lengthCm: null, weightG: null, measure: "crown-rump", size: "เมล็ดถั่วเขียว", development: "ตุ่มแขนขาโผล่ เริ่มสร้างเม็ดเลือด โครงหู ตา ปาก ปรากฏ" },
  { week: 7, trimester: 1, lengthCm: null, weightG: null, measure: "crown-rump", size: "เมล็ดข้าวโพด", development: "กระดูกเริ่มแทนที่กระดูกอ่อน อวัยวะเพศเริ่มก่อตัว" },
  { week: 8, trimester: 1, lengthCm: 1.6, weightG: 1, measure: "crown-rump", size: "มะเขือพวง", development: "อวัยวะและระบบสำคัญทุกอย่างกำลังพัฒนา สายสะดือสมบูรณ์" },
  { week: 9, trimester: 1, lengthCm: 2.3, weightG: 2, measure: "crown-rump", size: "องุ่น", development: "หน่อฟันและตุ่มรับรสก่อตัว กล้ามเนื้อเริ่มพัฒนา" },
  { week: 10, trimester: 1, lengthCm: 3.1, weightG: 4, measure: "crown-rump", size: "ส้มจี๊ด", development: "แขนขาครบรูป เล็บมือเล็บเท้าเริ่มงอก ใบหูด้านนอกก่อตัว" },
  { week: 11, trimester: 1, lengthCm: 4.1, weightG: 7, measure: "crown-rump", size: "ลูกพุทรา", development: "เริ่มขยับมือเข้าปาก กระดูกแข็งขึ้น ผิวยังโปร่งใส" },
  { week: 12, trimester: 1, lengthCm: 5.4, weightG: 14, measure: "crown-rump", size: "มะนาว", development: "อวัยวะ แขนขา กระดูกครบแล้ว ระบบไหลเวียนเลือดและย่อยอาหารเริ่มทำงาน" },
  { week: 13, trimester: 2, lengthCm: 7.4, weightG: 23, measure: "crown-rump", size: "ฝักถั่วลันเตา", development: "เส้นเสียงก่อตัว ศีรษะเริ่มได้สัดส่วนกับลำตัว" },
  { week: 14, trimester: 2, lengthCm: 8.7, weightG: 43, measure: "crown-rump", size: "มะกรูด", development: "ผิวหนาขึ้น ขนอ่อนเริ่มขึ้น ลายนิ้วมือเริ่มก่อตัว" },
  { week: 15, trimester: 2, lengthCm: 10.1, weightG: 70, measure: "crown-rump", size: "แอปเปิล", development: "อวัยวะภายในย้ายเข้าที่ ปอดกำลังพัฒนา เคลื่อนไหวมีจุดหมายมากขึ้น" },
  { week: 16, trimester: 2, lengthCm: 11.6, weightG: 100, measure: "crown-rump", size: "อะโวคาโด", development: "เริ่มได้ยินเสียง ริมฝีปากและใบหูสมบูรณ์ ตอบสนองต่อแสง" },
  { week: 17, trimester: 2, lengthCm: 13.0, weightG: 140, measure: "crown-rump", size: "ลูกแพร์", development: "ผิวบางเริ่มก่อตัว เริ่มสะสมไขมัน มีไขคลุมผิว (vernix)" },
  { week: 18, trimester: 2, lengthCm: 14.2, weightG: 190, measure: "crown-rump", size: "พริกหวาน", development: "ขนอ่อน (lanugo) คลุมทั้งตัว เริ่มมีวงจรหลับ-ตื่น" },
  { week: 19, trimester: 2, lengthCm: 15.3, weightG: 240, measure: "crown-rump", size: "มะเขือเทศลูกใหญ่", development: "แรงขึ้น เตะและต่อยรู้สึกได้ ลายนิ้วมือเฉพาะตัวสมบูรณ์ อาจสะอึก" },
  { week: 20, trimester: 2, lengthCm: 16.4, weightG: 300, measure: "crown-rump", size: "กล้วยหอม", development: "เล็บยาวถึงปลายนิ้ว สมองส่วนรับความรู้สึกกำลังพัฒนา" },
  { week: 21, trimester: 2, lengthCm: 26.7, weightG: 360, measure: "crown-heel", size: "แครอท", development: "ขยับแขนขาประสานกันได้ ไขกระดูกเริ่มสร้างเม็ดเลือด" },
  { week: 22, trimester: 2, lengthCm: 27.8, weightG: 430, measure: "crown-heel", size: "มะละกอลูกเล็ก", development: "กำมือแน่นขึ้น ตอบสนองต่อเสียงหัวใจและเสียงในร่างกายแม่" },
  { week: 23, trimester: 2, lengthCm: 28.9, weightG: 501, measure: "crown-heel", size: "มะม่วง", development: "เริ่มสะสมไขมันเร็วขึ้น — ระยะที่ทารกเริ่มมีโอกาสรอดหากคลอดก่อนกำหนดโดยต้องดูแลเข้มข้น" },
  { week: 24, trimester: 2, lengthCm: 30.0, weightG: 600, measure: "crown-heel", size: "ข้าวโพด", development: "ปอดพัฒนาครบโครงสร้างแล้ว แต่ยังทำงานเองนอกครรภ์ไม่ได้" },
  { week: 25, trimester: 2, lengthCm: 34.6, weightG: 660, measure: "crown-heel", size: "ฟักทองลูกเล็ก", development: "ไขมันเพิ่มขึ้น ผิวเรียบขึ้น ระบบประสาทกำลังสมบูรณ์" },
  { week: 26, trimester: 2, lengthCm: 35.6, weightG: 760, measure: "crown-heel", size: "ผักกาดหอม", development: "เริ่มสร้างเม็ดสีผิว ปอดเริ่มสร้างสารลดแรงตึงผิว (surfactant)" },
  { week: 27, trimester: 2, lengthCm: 36.6, weightG: 875, measure: "crown-heel", size: "ดอกกะหล่ำ", development: "ลืมตาและกะพริบตาได้ ขนตาขึ้น" },
  { week: 28, trimester: 3, lengthCm: 37.6, weightG: 1005, measure: "crown-heel", size: "มะเขือม่วง", development: "อาจเริ่มกลับหัวลง" },
  { week: 29, trimester: 3, lengthCm: 38.6, weightG: 1153, measure: "crown-heel", size: "ฟักทองญี่ปุ่น", development: "พื้นที่ในครรภ์แคบลง การเตะจะรู้สึกเหมือนถูกดัน" },
  { week: 30, trimester: 3, lengthCm: 39.9, weightG: 1319, measure: "crown-heel", size: "กะหล่ำปลี", development: "เริ่มควบคุมอุณหภูมิร่างกายเองได้ สมองพัฒนาเร็วมาก" },
  { week: 31, trimester: 3, lengthCm: 41.1, weightG: 1502, measure: "crown-heel", size: "มะพร้าว", development: "ประมวลข้อมูลได้มากขึ้น เห็นรูปแบบหลับ-ตื่นชัดเจน" },
  { week: 32, trimester: 3, lengthCm: 42.4, weightG: 1702, measure: "crown-heel", size: "มันแกว", development: "ผิวไม่โปร่งแสงแล้ว อวัยวะส่วนใหญ่ก่อตัวสมบูรณ์" },
  { week: 33, trimester: 3, lengthCm: 43.7, weightG: 1918, measure: "crown-heel", size: "สับปะรด", development: "กระดูกแข็งขึ้นทั้งหมด ยกเว้นกะโหลกที่ยังนิ่มเพื่อผ่านช่องคลอด" },
  { week: 34, trimester: 3, lengthCm: 45.0, weightG: 2146, measure: "crown-heel", size: "แคนตาลูป", development: "ไขคลุมผิวหนาขึ้นเพื่อปกป้องผิว" },
  { week: 35, trimester: 3, lengthCm: 46.2, weightG: 2383, measure: "crown-heel", size: "เมล่อน", development: "สมองยังโตต่อ — หนักราว 2 ใน 3 ของน้ำหนักสมองตอนคลอด" },
  { week: 36, trimester: 3, lengthCm: 47.4, weightG: 2622, measure: "crown-heel", size: "ส้มโอ", development: "ขนอ่อนเริ่มหลุด มีผมบนศีรษะแล้ว" },
  { week: 37, trimester: 3, lengthCm: 48.6, weightG: 2859, measure: "crown-heel", size: "แตงโมลูกเล็ก", development: "เล็บเท้ายาวถึงปลายนิ้ว อาจรู้สึกว่าทารกเคลื่อนลงสู่อุ้งเชิงกราน" },
  { week: 38, trimester: 3, lengthCm: 49.8, weightG: 3083, measure: "crown-heel", size: "ฟักเขียว", development: "น้ำหนักเพิ่มราวสัปดาห์ละ 200 กรัม" },
  { week: 39, trimester: 3, lengthCm: 50.7, weightG: 3288, measure: "crown-heel", size: "แตงโม", development: "ครบกำหนดเต็มที่ (full term) พร้อมคลอด" },
  { week: 40, trimester: 3, lengthCm: 51.2, weightG: 3462, measure: "crown-heel", size: "ฟักทอง", development: "ถึงกำหนดคลอด" },
];

/** null เมื่ออายุครรภ์ยังไม่ถึง 4 สัปดาห์ หรือเลย 40 ไปแล้ว */
export function weeklyContent(week: number | null | undefined): WeeklyContent | null {
  if (week == null || week < MIN_WEEK || week > MAX_WEEK) return null;
  return WEEKLY_CONTENT[week - MIN_WEEK] ?? null;
}

/**
 * รูปเทียบขนาดเก็บใน bucket public ชื่อไฟล์ผูกกับเลขสัปดาห์แบบเติมศูนย์
 * เช่น สัปดาห์ 4 -> weekly/size/w04.webp
 * ยังไม่มีไฟล์จริงในตอนนี้ — UI ต้องมี fallback เมื่อโหลดไม่ขึ้น
 */
export const sizeImageKey = (week: number) => `weekly/size/w${String(week).padStart(2, "0")}.webp`;
