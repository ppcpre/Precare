/**
 * ประมาณค่าโภชนาการจากชื่อเมนู ด้วย Workers AI
 *
 * ⚠️ ตัวเลขที่ได้คือ "ค่าประมาณจากชื่อเมนู" ไม่ใช่การวัด และโมเดลตอบผิดแบบ
 * มั่นใจได้ (เคยเจอกับการอ่านใบเสร็จ — ตอบเลขผิดเหมือนเดิมสามครั้งติด)
 * ทุกค่าจึงต้องแก้ได้ และหน้าจอต้องบอกเสมอว่าเป็นค่าประมาณ
 *
 * ไม่ log คำตอบของโมเดลเด็ดขาด — ชื่ออาหารที่ผู้ใช้กินเป็นข้อมูลสุขภาพ
 */
import type { MealSlot } from "@/db/schema";

/**
 * โมเดลที่ใช้ — SEA-LION สร้างมาเพื่อภาษาเอเชียตะวันออกเฉียงใต้รวมภาษาไทย
 * จึงเข้าใจชื่ออาหารไทยอย่าง "ข้าวมันไก่" "ส้มตำปูปลาร้า" ได้ตรงกว่าโมเดลทั่วไป
 *
 * แยกเป็นค่าคงที่เพื่อให้สลับไปวัดเทียบกับตัวอื่นได้โดยไม่ต้องไล่แก้หลายที่
 * (ตัวเลือกอื่นที่มีในบัญชี: @cf/meta/llama-3.3-70b-instruct-fp8-fast ใหญ่กว่า
 * แต่กิน neurons มากกว่า · @cf/meta/llama-3.2-3b-instruct เล็กและถูกที่สุด)
 */
export const NUTRITION_MODEL = "@cf/aisingapore/gemma-sea-lion-v4-27b-it";

export interface Nutrition {
  kcal: number;
  carbG: number;
  sugarG: number;
  proteinG: number;
  /** สมมติฐานที่โมเดลใช้ เช่น "ข้าวมันไก่ 1 จาน ~350 ก." — ต้องโชว์ให้ผู้ใช้เห็น */
  basis: string | null;
}

export type NutritionRead =
  | { status: "read"; value: Nutrition }
  | { status: "not_found" }
  | { status: "unavailable" };

/**
 * เพดานความสมเหตุสมผลของหนึ่งเมนู
 *
 * ไม่ได้กันโมเดลโกหกเล็กน้อย แต่กันคำตอบที่ผิดจนเป็นอันตราย เช่น 50,000 kcal
 * ซึ่งถ้าปล่อยเข้าไป ยอดรวมทั้งวันจะเพี้ยนจนผู้ใช้สับสนว่าตัวเองกินอะไรไป
 */
const LIMITS = { kcal: 3000, carbG: 500, sugarG: 400, proteinG: 300 } as const;

export const PROMPT = `คุณคือผู้ช่วยด้านโภชนาการ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

ประมาณค่าโภชนาการของอาหารไทยที่ระบุ ตามปริมาณที่ให้มา
ตอบรูปแบบนี้เท่านั้น:
{"kcal": number, "carb_g": number, "sugar_g": number, "protein_g": number, "basis": "สมมติฐานที่ใช้ เป็นภาษาไทยสั้นๆ"}

กติกา
- ถ้าไม่รู้จักอาหารนี้ ตอบ {"unknown": true}
- carb_g คือคาร์โบไฮเดรตทั้งหมด · sugar_g คือน้ำตาลซึ่งเป็นส่วนหนึ่งของ carb_g
- basis ต้องบอกน้ำหนักหรือขนาดที่ใช้คิด เช่น "1 จาน ประมาณ 350 กรัม"
- ตัวเลขเป็นจำนวนเต็ม ไม่ต้องมีหน่วย`;

/**
 * อ่าน JSON จากคำตอบของโมเดล
 *
 * โมเดลชอบห่อคำตอบด้วย \`\`\`json หรือพิมพ์คำนำหน้า แม้จะสั่งว่าห้ามก็ตาม
 * จึงต้องหาก้อน {...} เองแทนที่จะ JSON.parse ทั้งสตริง
 */
export function parseNutrition(text: string | null): Nutrition | null {
  if (!text) return null;
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  if (o.unknown === true) return null;

  const num = (v: unknown, cap: number): number | null => {
    const n = typeof v === "string" ? Number(v) : v;
    if (typeof n !== "number" || !Number.isFinite(n) || n < 0 || n > cap) return null;
    return Math.round(n);
  };

  const kcal = num(o.kcal, LIMITS.kcal);
  const carbG = num(o.carb_g, LIMITS.carbG);
  const proteinG = num(o.protein_g, LIMITS.proteinG);
  let sugarG = num(o.sugar_g, LIMITS.sugarG);
  // ค่าหลักขาดไปแม้แต่ตัวเดียวถือว่าอ่านไม่ได้ ดีกว่าโชว์ครึ่งๆ กลางๆ
  if (kcal == null || carbG == null || proteinG == null || sugarG == null) return null;

  // น้ำตาลเป็นส่วนหนึ่งของคาร์บ มากกว่ากันไม่ได้ — โมเดลสลับสองค่านี้บ่อย
  if (sugarG > carbG) sugarG = carbG;

  const basis = typeof o.basis === "string" ? o.basis.trim().slice(0, 120) : null;
  return { kcal, carbG, sugarG, proteinG, basis: basis || null };
}

/**
 * แยก "จำนวน" ออกจาก "หน่วย" ของปริมาณที่ผู้ใช้พิมพ์
 *
 * มีเพราะ**โมเดลคูณเลขไม่เป็น** วัดจริงเมื่อ 5 ต.ค. 69 ด้วย prompt ตัวนี้:
 *   ข้าวมันไก่ 1 จาน    -> 650 kcal (basis บอก 400 ก.)
 *   ข้าวมันไก่ 1/4 จาน  -> 450 kcal (basis บอก "1/4 จาน ประมาณ 250 ก.")
 *   ข้าวมันไก่ 0.5 จาน  -> 550 kcal
 * 1/4 จานควรได้ ~163 แต่ได้ 450 คือ 69% ของจานเต็ม และ basis ขัดแย้งในตัวเอง
 * (หนึ่งในสี่ของจาน 400 ก. ไม่ใช่ 250 ก.) มันแค่ขยับค่าลงให้ดูเหมือนคิดแล้ว
 *
 * จึงถามโมเดลแค่ "1 หน่วย" ซึ่งเป็นสิ่งที่มันพอตอบได้ แล้วคูณเองในโค้ด
 * เลขคณิตเป็นงานที่เครื่องทำถูกเสมอ ไม่ควรฝากไว้กับตัวทำนายคำถัดไป
 */
export interface Portion {
  qty: number;
  /** หน่วยที่เหลือหลังตัดจำนวนออก เช่น "จาน" — ว่างได้ถ้าผู้ใช้พิมพ์แต่ตัวเลข */
  unit: string;
}

/** เศษส่วนยูนิโคดที่คนกดจากแป้นพิมพ์มือถือได้ */
const GLYPH: Record<string, number> = {
  "½": 0.5, "⅓": 1 / 3, "⅔": 2 / 3, "¼": 0.25, "¾": 0.75, "⅕": 0.2, "⅛": 0.125,
};

/** คำบอกจำนวนที่คนไทยพิมพ์จริง */
const WORD: Record<string, number> = {
  ครึ่ง: 0.5, "ค่อนครึ่ง": 0.5, หนึ่ง: 1, สอง: 2, สาม: 3, สี่: 4, ห้า: 5,
};

/** กันค่าพิลึก — 0.05 จานคือหนึ่งคำ ส่วน 20 จานคือกินทั้งหม้อ */
const QTY_MIN = 0.05;
const QTY_MAX = 20;

export function parsePortion(portion: string | null): Portion {
  const text = (portion ?? "").trim();
  if (!text) return { qty: 1, unit: "" };

  const clamp = (n: number) => Math.min(QTY_MAX, Math.max(QTY_MIN, n));
  const rest = (s: string) => s.replace(/^[\s·.]+|[\s·.]+$/g, "");

  // "1 1/2 จาน" — จำนวนคละเศษ ต้องลองก่อนเศษส่วนเปล่า ไม่งั้นจะอ่านได้แค่ 1
  const mixed = text.match(/^(\d+)\s+(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (mixed) {
    // ส่วนเป็นศูนย์คือค่าที่ไม่มีความหมาย ถือว่าอ่านจำนวนไม่ได้ทั้งก้อน
    // ห้ามปล่อยให้ไหลไปเข้าเงื่อนไขตัวเลขข้างล่าง ไม่งั้น "1/0 จาน" จะกลายเป็น
    // จำนวน 1 ของหน่วย "/0 จาน" แล้วสตริงพิลึกนั้นจะถูกส่งไปถาม AI
    if (Number(mixed[3]) === 0) return { qty: 1, unit: text };
    const q = Number(mixed[1]) + Number(mixed[2]) / Number(mixed[3]);
    return { qty: clamp(q), unit: rest(mixed[4]) };
  }

  // "1/4 จาน"
  const frac = text.match(/^(\d+)\s*\/\s*(\d+)\s*(.*)$/);
  if (frac) {
    if (Number(frac[2]) === 0) return { qty: 1, unit: text };
    return { qty: clamp(Number(frac[1]) / Number(frac[2])), unit: rest(frac[3]) };
  }

  // "0.5 จาน" "2 แก้ว" "1,5"? ไม่รับคอมมาเป็นจุดทศนิยม คนไทยใช้จุด
  const num = text.match(/^(\d+(?:\.\d+)?)\s*(.*)$/);
  if (num) return { qty: clamp(Number(num[1])), unit: rest(num[2]) };

  // "½ จาน"
  const glyph = text.match(/^([½⅓⅔¼¾⅕⅛])\s*(.*)$/);
  if (glyph) return { qty: clamp(GLYPH[glyph[1]]), unit: rest(glyph[2]) };

  // "ครึ่งจาน" "สองแก้ว" — ไม่มีช่องว่างคั่นก็ต้องอ่านได้
  for (const [word, q] of Object.entries(WORD)) {
    if (text.startsWith(word)) return { qty: clamp(q), unit: rest(text.slice(word.length)) };
  }

  // อ่านจำนวนไม่ได้ ถือว่าหนึ่งหน่วยของสิ่งที่พิมพ์มา เช่น "ถ้วยเล็ก"
  return { qty: 1, unit: text };
}

/**
 * คูณค่าโภชนาการตามจำนวนหน่วย แล้วบอกให้ผู้ใช้เห็นว่าคูณมาจากอะไร
 *
 * เพดานต่อเมนูยังบังคับหลังคูณด้วย — ไม่งั้น "10 จาน" จะทะลุเพดานที่ตั้งไว้
 * เพื่อกันยอดรวมทั้งวันเพี้ยน
 */
export function scaleNutrition(v: Nutrition, qty: number, portionText: string): Nutrition {
  if (qty === 1) return v;
  const at = (n: number, cap: number) => Math.min(cap, Math.round(n * qty));
  const sugarG = at(v.sugarG, LIMITS.sugarG);
  const carbG = at(v.carbG, LIMITS.carbG);
  return {
    kcal: at(v.kcal, LIMITS.kcal),
    carbG,
    sugarG: Math.min(sugarG, carbG),
    proteinG: at(v.proteinG, LIMITS.proteinG),
    // โชว์ที่มาของการคูณ เพราะตัวเลขที่ "คิดมาแล้ว" ตรวจทานไม่ได้ถ้าไม่บอกวิธี
    basis: v.basis ? `${v.basis} × ${portionText}` : `คูณจาก 1 หน่วย × ${portionText}`,
  };
}

export async function estimateNutrition(
  ai: Ai | undefined,
  name: string,
  portion: string | null,
): Promise<NutritionRead> {
  if (!ai) return { status: "unavailable" };

  /**
   * ถามแค่หนึ่งหน่วยเสมอ แล้วคูณเองในโค้ด — ดู parsePortion ว่าทำไม
   * "ข้าวมันไก่ 1/4 จาน" จึงกลายเป็นคำถาม "ข้าวมันไก่ 1 จาน" แล้วคูณ 0.25
   */
  const { qty, unit } = parsePortion(portion ?? null);
  const dish = unit ? `${name} 1 ${unit}` : name;

  try {
    const res = (await ai.run(NUTRITION_MODEL as keyof AiModels, {
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: dish },
      ],
      max_tokens: 200,
    } as never)) as { response?: string; choices?: { message?: { content?: string } }[] };

    const text = res?.choices?.[0]?.message?.content ?? res?.response ?? null;
    const value = parseNutrition(text);
    if (!value) return { status: "not_found" };
    return { status: "read", value: scaleNutrition(value, qty, (portion ?? "").trim()) };
  } catch {
    // ไม่ log: error อาจพ่วงเนื้อหาคำขอมาด้วย ซึ่งคือสิ่งที่ผู้ใช้กิน
    // โควตาฟรีหมดก็มาทางนี้ — กรอกเองได้ ไม่ใช่เรื่องที่ต้องล้ม
    return { status: "unavailable" };
  }
}

export const SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: "เช้า",
  lunch: "กลางวัน",
  dinner: "เย็น",
  snack: "ว่าง",
};
