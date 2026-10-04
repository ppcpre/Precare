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

const PROMPT = `คุณคือผู้ช่วยด้านโภชนาการ ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

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

export async function estimateNutrition(
  ai: Ai | undefined,
  name: string,
  portion: string | null,
): Promise<NutritionRead> {
  if (!ai) return { status: "unavailable" };
  const dish = portion ? `${name} ${portion}` : name;

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
    return value ? { status: "read", value } : { status: "not_found" };
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
