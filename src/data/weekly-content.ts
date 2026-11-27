/**
 * เนื้อหารายสัปดาห์ 4–40 สำหรับการ์ด "ขนาดของลูกน้อย" และ "พัฒนาการของหนูน้อย"
 *
 * เก็บเป็น static ในโค้ด ไม่เข้า D1 — เป็นข้อมูลคงที่ 37 แถว ไม่มีใครแก้
 * ประหยัดทั้ง row read และ latency ต่อการเปิดหน้าแรกหนึ่งครั้ง
 *
 * ที่มา (ดูฉบับเต็มพร้อมลิงก์ใน docs/pregnancy-weekly-data.md)
 * - น้ำหนักสัปดาห์ 14–40: WHO Fetal Growth Charts (Kiserud et al., PLOS Med 2017)
 *   ตารางที่ 11 เปอร์เซ็นไทล์ที่ 10 / 50 / 90 รวมทุกเพศ
 * - น้ำหนักสัปดาห์ 8–13: ค่าประมาณ ไม่มีเกณฑ์มาตรฐาน (ดูด้านล่าง)
 * - ความยาว: Fetal Growth Chart, Utah Department of Health
 * - พัฒนาการ: Cleveland Clinic
 *
 * ทำไมถึงเปลี่ยนมาใช้ WHO (29 ต.ค. 69)
 *
 * ชุดเดิมใช้น้ำหนักจาก Utah ซึ่งต่ำกว่าความจริงอย่างเป็นระบบ — 10 สัปดาห์จาก 27
 * (14–18 และ 25–29) ค่าที่เราเรียกว่า "ค่าเฉลี่ย" ต่ำกว่า**เปอร์เซ็นไทล์ที่ 10**
 * ของ WHO ด้วยซ้ำ หนักสุดคือสัปดาห์ 28 ที่ต่ำไป 15% (1,005 vs 1,189 ก.)
 *
 * สาเหตุน่าจะเป็นปัญหาคลาสสิกของตารางที่สร้างจาก "น้ำหนักแรกเกิด" แทนการวัด
 * ในครรภ์ — เด็กที่คลอดตอน 28 สัปดาห์ส่วนใหญ่คลอดก่อนกำหนดเพราะโตช้าอยู่แล้ว
 * ตารางจึงเอนต่ำในช่วงก่อนครบกำหนด ซึ่งตรงกับรูปแบบที่เห็น (ต่ำสุดช่วงกลาง
 * แล้วค่อยๆ เข้าใกล้ความจริงเมื่อถึง 40 สัปดาห์)
 *
 * WHO 2017 เหมาะกว่าสามข้อ: วัดในครรภ์จริงจากครรภ์ปกติที่ติดตามต่อเนื่อง,
 * มีไทยอยู่ในการศึกษา (ม.ขอนแก่น), และใกล้เคียงสูตร Hadlock ที่เครื่อง
 * อัลตราซาวด์ใช้คำนวณ EFW — แอปกับที่หมอบอกจะได้พูดตรงกัน
 *
 * ⚠️ มีรอยต่อที่สัปดาห์ 13→14 (23 → 90 ก.)
 *
 * WHO เริ่มที่สัปดาห์ 14 เพราะก่อนหน้านั้นทางคลินิกไม่ได้คิดน้ำหนัก เขาวัด
 * ความยาวหัวถึงก้น (CRL) ตัวเลขสัปดาห์ 8–13 จึงยังเป็นของชุดเดิมซึ่งน่าจะต่ำ
 * เหมือนกัน แต่เราไม่มีแหล่งอ้างอิงที่ดีกว่ามาแทน — จึงกำกับไว้ว่าเป็นค่าประมาณ
 * และไม่แสดงช่วงปกติให้ ถ้าวันหนึ่งเจอแหล่งที่เชื่อถือได้สำหรับช่วงนี้ ให้แก้
 * พร้อมกันทั้งสองที่ อย่าแก้ตัวเลขให้เส้นเรียบโดยไม่มีที่มา
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
   * ช่วงปกติ = เปอร์เซ็นไทล์ที่ 10 ถึง 90 ของ WHO — null ก่อนสัปดาห์ 14
   *
   * มีเพราะเลขตัวเดียวตอบคำถามที่คนถามจริงไม่ได้ ครึ่งหนึ่งของเด็กปกติ
   * ต้องต่ำกว่าค่ากลางอยู่แล้ว การโชว์แค่ "ค่าเฉลี่ย" จึงทำให้พ่อแม่ครึ่งหนึ่ง
   * คิดว่าลูกตัวเล็กผิดปกติ และอธิบายไม่ได้ว่าทำไมเลขที่หมอบอกถึงไม่ตรง
   */
  weightLowG: number | null;
  weightHighG: number | null;
  /**
   * วิธีวัดเปลี่ยนที่สัปดาห์ 21 — จากหัวถึงก้น เป็นหัวถึงส้นเท้า
   * ตัวเลขจึงกระโดดจาก 16.4 เป็น 26.7 ซม. ในสัปดาห์เดียว
   * ต้องอธิบายใน UI ไม่งั้นผู้ใช้ตกใจว่าลูกโตขึ้น 10 ซม. ในเจ็ดวัน
   */
  measure: "crown-rump" | "crown-heel";
  size: string;
  development: string;
}

/**
 * สั้นให้พอดีบรรทัดเดียวบนมือถือ — ของเดิมยาวสองบรรทัดครึ่งเมื่อรวมกับ
 * ข้อความของฝั่งพัฒนาการ กินความสูงมากกว่าตัวเนื้อหาที่มันกำกับอยู่
 * ใจความที่ห้ามหายคือ "เป็นค่าเฉลี่ย" กับ "ไม่ใช่คำแนะนำทางการแพทย์"
 */
export const DISCLAIMER =
  "ค่าอ้างอิงจาก WHO ลูกแต่ละคนต่างกันได้ ไม่ใช่คำแนะนำทางการแพทย์";

/** กำกับน้ำหนักช่วงที่ยังไม่มีเกณฑ์มาตรฐาน — สัปดาห์ 8–13 */
export const APPROX_NOTE = "ช่วงนี้ยังไม่มีเกณฑ์มาตรฐาน น้ำหนักเป็นค่าประมาณ";

/** สัปดาห์แรกที่มีเกณฑ์ของ WHO */
export const WHO_FIRST_WEEK = 14;

/**
 * รอยกระโดดของ "ความยาว" ที่ต้องอธิบายบนหน้าจอ
 *
 * ความยาวทารกทั้งตัวในครรภ์ **วัดด้วยอัลตราซาวด์ไม่ได้** หมอวัด BPD / HC / AC /
 * FL แล้วคำนวณน้ำหนัก ส่วนความยาวทั้งตัววัดได้ตอนคลอดเท่านั้น ตารางความยาว
 * รายสัปดาห์ทุกเจ้าจึงเป็นค่าที่ได้มาทางอ้อม และมักเอาหลายชุดมาต่อกัน
 *
 * ชุดของเรามีรอยต่อสองจุด:
 *
 * สัปดาห์ 21 — ตั้งใจ เปลี่ยนวิธีวัดจากหัวถึงก้นเป็นหัวถึงส้นเท้า (16.4 → 26.7)
 *
 * สัปดาห์ 25 — **ข้อบกพร่องของข้อมูล ไม่ใช่ของที่ตั้งใจ** (30.0 → 34.6)
 *   สัปดาห์ 21–24 ก้าวทีละ 1.1 ซม. เป๊ะทุกสัปดาห์ ซึ่งดูเหมือนเติมเอาเอง
 *   ส่วน 25–40 เป็นอีกชุดที่อยู่สูงกว่าแนวของ 21–24 ราว 3.5 ซม.
 *   เทียบกับตารางอิง WHO ที่ให้ 24 สัปดาห์ = 32.2 ซม. แล้ว ชุด 21–24 ของเรา
 *   น่าจะสั้นไป แต่ยังหาแหล่งที่ระบุวิธีวัดชัดเจนมาแทนทั้งบล็อกไม่ได้
 *
 *   ⚠️ ห้ามแก้ตัวเลขให้เส้นเรียบเองเด็ดขาด — ที่ทำได้ตอนนี้คือบอกผู้ใช้ตรงๆ
 *      ว่าทำไมตัวเลขกระโดด และกันไม่ให้มีรอยใหม่โผล่มาโดยไม่มีใครรู้
 */
export const LENGTH_JUMP_WEEKS = [21, 25] as const;

/** คำอธิบายรอยกระโดด — null เมื่อสัปดาห์นั้นไม่ได้อยู่ติดรอยต่อ */
export function lengthJumpNote(week: number): string | null {
  if (week >= 21 && week <= 22) {
    return "ตั้งแต่สัปดาห์ที่ 21 เปลี่ยนวิธีวัดจาก หัวถึงก้น เป็น หัวถึงส้นเท้า ตัวเลขจึงเพิ่มขึ้นมากในสัปดาห์เดียว ไม่ได้แปลว่าลูกโตผิดปกติ";
  }
  if (week >= 25 && week <= 26) {
    return "ตัวเลขช่วงนี้มาจากตารางอ้างอิงคนละชุดกับสัปดาห์ก่อนหน้า จึงต่อกันไม่สนิท ความยาวทั้งตัวของทารกในครรภ์วัดโดยตรงไม่ได้ ใช้ดูคร่าวๆ เท่านั้น";
  }
  return null;
}

export const MIN_WEEK = 4;
export const MAX_WEEK = 40;

export const WEEKLY_CONTENT: readonly WeeklyContent[] = [
  { week: 4, trimester: 1, lengthCm: null, weightG: null, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "เมล็ดงาดำ", development: "ตัวอ่อนฝังตัวที่ผนังมดลูก ถุงน้ำคร่ำเริ่มก่อตัว" },
  { week: 5, trimester: 1, lengthCm: null, weightG: null, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "เมล็ดงา", development: "ท่อประสาทเริ่มสร้าง หัวใจเริ่มเต้นราว 110 ครั้ง/นาที" },
  { week: 6, trimester: 1, lengthCm: null, weightG: null, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "เมล็ดถั่วเขียว", development: "ตุ่มแขนขาโผล่ เริ่มสร้างเม็ดเลือด โครงหู ตา ปาก ปรากฏ" },
  { week: 7, trimester: 1, lengthCm: null, weightG: null, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "เมล็ดข้าวโพด", development: "กระดูกเริ่มแทนที่กระดูกอ่อน อวัยวะเพศเริ่มก่อตัว" },
  { week: 8, trimester: 1, lengthCm: 1.6, weightG: 1, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "มะเขือพวง", development: "อวัยวะและระบบสำคัญทุกอย่างกำลังพัฒนา สายสะดือสมบูรณ์" },
  { week: 9, trimester: 1, lengthCm: 2.3, weightG: 2, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "องุ่น", development: "หน่อฟันและตุ่มรับรสก่อตัว กล้ามเนื้อเริ่มพัฒนา" },
  { week: 10, trimester: 1, lengthCm: 3.1, weightG: 4, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "ส้มจี๊ด", development: "แขนขาครบรูป เล็บมือเล็บเท้าเริ่มงอก ใบหูด้านนอกก่อตัว" },
  { week: 11, trimester: 1, lengthCm: 4.1, weightG: 7, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "ลูกพุทรา", development: "เริ่มขยับมือเข้าปาก กระดูกแข็งขึ้น ผิวยังโปร่งใส" },
  { week: 12, trimester: 1, lengthCm: 5.4, weightG: 14, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "มะนาว", development: "อวัยวะ แขนขา กระดูกครบแล้ว ระบบไหลเวียนเลือดและย่อยอาหารเริ่มทำงาน" },
  { week: 13, trimester: 2, lengthCm: 7.4, weightG: 23, weightLowG: null, weightHighG: null, measure: "crown-rump", size: "ฝักถั่วลันเตา", development: "เส้นเสียงก่อตัว ศีรษะเริ่มได้สัดส่วนกับลำตัว" },
  { week: 14, trimester: 2, lengthCm: 8.7, weightG: 90, weightLowG: 78, weightHighG: 104, measure: "crown-rump", size: "มะกรูด", development: "ผิวหนาขึ้น ขนอ่อนเริ่มขึ้น ลายนิ้วมือเริ่มก่อตัว" },
  { week: 15, trimester: 2, lengthCm: 10.1, weightG: 114, weightLowG: 99, weightHighG: 132, measure: "crown-rump", size: "แอปเปิล", development: "อวัยวะภายในย้ายเข้าที่ ปอดกำลังพัฒนา เคลื่อนไหวมีจุดหมายมากขึ้น" },
  { week: 16, trimester: 2, lengthCm: 11.6, weightG: 144, weightLowG: 124, weightHighG: 166, measure: "crown-rump", size: "อะโวคาโด", development: "เริ่มได้ยินเสียง ริมฝีปากและใบหูสมบูรณ์ ตอบสนองต่อแสง" },
  { week: 17, trimester: 2, lengthCm: 13.0, weightG: 179, weightLowG: 155, weightHighG: 207, measure: "crown-rump", size: "ลูกแพร์", development: "ผิวบางเริ่มก่อตัว เริ่มสะสมไขมัน มีไขคลุมผิว (vernix)" },
  { week: 18, trimester: 2, lengthCm: 14.2, weightG: 222, weightLowG: 192, weightHighG: 255, measure: "crown-rump", size: "พริกหวาน", development: "ขนอ่อน (lanugo) คลุมทั้งตัว เริ่มมีวงจรหลับ-ตื่น" },
  { week: 19, trimester: 2, lengthCm: 15.3, weightG: 272, weightLowG: 235, weightHighG: 313, measure: "crown-rump", size: "มะเขือเทศลูกใหญ่", development: "แรงขึ้น เตะและต่อยรู้สึกได้ ลายนิ้วมือเฉพาะตัวสมบูรณ์ อาจสะอึก" },
  { week: 20, trimester: 2, lengthCm: 16.4, weightG: 330, weightLowG: 286, weightHighG: 380, measure: "crown-rump", size: "กล้วยหอม", development: "เล็บยาวถึงปลายนิ้ว สมองส่วนรับความรู้สึกกำลังพัฒนา" },
  { week: 21, trimester: 2, lengthCm: 26.7, weightG: 398, weightLowG: 345, weightHighG: 458, measure: "crown-heel", size: "แครอท", development: "ขยับแขนขาประสานกันได้ ไขกระดูกเริ่มสร้างเม็ดเลือด" },
  { week: 22, trimester: 2, lengthCm: 27.8, weightG: 476, weightLowG: 412, weightHighG: 548, measure: "crown-heel", size: "มะละกอลูกเล็ก", development: "กำมือแน่นขึ้น ตอบสนองต่อเสียงหัวใจและเสียงในร่างกายแม่" },
  { week: 23, trimester: 2, lengthCm: 28.9, weightG: 565, weightLowG: 489, weightHighG: 650, measure: "crown-heel", size: "มะม่วง", development: "เริ่มสะสมไขมันเร็วขึ้น — ระยะที่ทารกเริ่มมีโอกาสรอดหากคลอดก่อนกำหนดโดยต้องดูแลเข้มข้น" },
  { week: 24, trimester: 2, lengthCm: 30.0, weightG: 665, weightLowG: 576, weightHighG: 765, measure: "crown-heel", size: "ข้าวโพด", development: "ปอดพัฒนาครบโครงสร้างแล้ว แต่ยังทำงานเองนอกครรภ์ไม่ได้" },
  { week: 25, trimester: 2, lengthCm: 34.6, weightG: 778, weightLowG: 673, weightHighG: 894, measure: "crown-heel", size: "ฟักทองลูกเล็ก", development: "ไขมันเพิ่มขึ้น ผิวเรียบขึ้น ระบบประสาทกำลังสมบูรณ์" },
  { week: 26, trimester: 2, lengthCm: 35.6, weightG: 902, weightLowG: 780, weightHighG: 1038, measure: "crown-heel", size: "ผักกาดหอม", development: "เริ่มสร้างเม็ดสีผิว ปอดเริ่มสร้างสารลดแรงตึงผิว (surfactant)" },
  { week: 27, trimester: 2, lengthCm: 36.6, weightG: 1039, weightLowG: 898, weightHighG: 1196, measure: "crown-heel", size: "ดอกกะหล่ำ", development: "ลืมตาและกะพริบตาได้ ขนตาขึ้น" },
  { week: 28, trimester: 3, lengthCm: 37.6, weightG: 1189, weightLowG: 1026, weightHighG: 1368, measure: "crown-heel", size: "มะเขือม่วง", development: "อาจเริ่มกลับหัวลง" },
  { week: 29, trimester: 3, lengthCm: 38.6, weightG: 1350, weightLowG: 1165, weightHighG: 1554, measure: "crown-heel", size: "ฟักทองญี่ปุ่น", development: "พื้นที่ในครรภ์แคบลง การเตะจะรู้สึกเหมือนถูกดัน" },
  { week: 30, trimester: 3, lengthCm: 39.9, weightG: 1523, weightLowG: 1313, weightHighG: 1753, measure: "crown-heel", size: "กะหล่ำปลี", development: "เริ่มควบคุมอุณหภูมิร่างกายเองได้ สมองพัฒนาเร็วมาก" },
  { week: 31, trimester: 3, lengthCm: 41.1, weightG: 1707, weightLowG: 1470, weightHighG: 1964, measure: "crown-heel", size: "มะพร้าว", development: "ประมวลข้อมูลได้มากขึ้น เห็นรูปแบบหลับ-ตื่นชัดเจน" },
  { week: 32, trimester: 3, lengthCm: 42.4, weightG: 1901, weightLowG: 1635, weightHighG: 2187, measure: "crown-heel", size: "มันแกว", development: "ผิวไม่โปร่งแสงแล้ว อวัยวะส่วนใหญ่ก่อตัวสมบูรณ์" },
  { week: 33, trimester: 3, lengthCm: 43.7, weightG: 2103, weightLowG: 1807, weightHighG: 2419, measure: "crown-heel", size: "สับปะรด", development: "กระดูกแข็งขึ้นทั้งหมด ยกเว้นกะโหลกที่ยังนิ่มเพื่อผ่านช่องคลอด" },
  { week: 34, trimester: 3, lengthCm: 45.0, weightG: 2312, weightLowG: 1985, weightHighG: 2659, measure: "crown-heel", size: "แคนตาลูป", development: "ไขคลุมผิวหนาขึ้นเพื่อปกป้องผิว" },
  { week: 35, trimester: 3, lengthCm: 46.2, weightG: 2527, weightLowG: 2167, weightHighG: 2904, measure: "crown-heel", size: "เมล่อน", development: "สมองยังโตต่อ — หนักราว 2 ใน 3 ของน้ำหนักสมองตอนคลอด" },
  { week: 36, trimester: 3, lengthCm: 47.4, weightG: 2745, weightLowG: 2352, weightHighG: 3153, measure: "crown-heel", size: "ส้มโอ", development: "ขนอ่อนเริ่มหลุด มีผมบนศีรษะแล้ว" },
  { week: 37, trimester: 3, lengthCm: 48.6, weightG: 2966, weightLowG: 2537, weightHighG: 3403, measure: "crown-heel", size: "แตงโมลูกเล็ก", development: "เล็บเท้ายาวถึงปลายนิ้ว อาจรู้สึกว่าทารกเคลื่อนลงสู่อุ้งเชิงกราน" },
  { week: 38, trimester: 3, lengthCm: 49.8, weightG: 3186, weightLowG: 2723, weightHighG: 3652, measure: "crown-heel", size: "ฟักเขียว", development: "น้ำหนักเพิ่มราวสัปดาห์ละ 200 กรัม" },
  { week: 39, trimester: 3, lengthCm: 50.7, weightG: 3403, weightLowG: 2905, weightHighG: 3897, measure: "crown-heel", size: "แตงโม", development: "ครบกำหนดเต็มที่ (full term) พร้อมคลอด" },
  { week: 40, trimester: 3, lengthCm: 51.2, weightG: 3617, weightLowG: 3084, weightHighG: 4135, measure: "crown-heel", size: "ฟักทอง", development: "ถึงกำหนดคลอด" },
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
