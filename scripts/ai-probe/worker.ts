/**
 * ตัวยิงถาม Workers AI เพื่อ "วัด" ไม่ใช่ "เดา" ว่าโมเดลตอบอะไร
 *
 * ใช้ prompt และโมเดลตัวเดียวกับของจริง (import จาก src/lib/nutrition.ts)
 * ผลที่วัดได้จึงเป็นผลของระบบจริง ไม่ใช่ของ prompt ที่เขียนขึ้นมาใหม่เพื่อทดสอบ
 *
 * วิธีรัน (ใช้ wrangler login ที่มีอยู่ ไม่ต้องมี API token):
 *   npx wrangler dev --config scripts/ai-probe/wrangler.jsonc --remote --port 8799
 *   curl -s 'http://localhost:8799/?q=ข้าวมันไก่%201%2F4%20จาน'      # prompt ดิบ
 *   curl -s 'http://localhost:8799/?name=ข้าวมันไก่&portion=1/4%20จาน'  # ทั้งเส้นทางจริง
 *
 * กินโควตา AI ของบัญชีจริง (แพลนฟรี 10,000 neurons/วัน) ยิงเท่าที่จำเป็น
 */
import {
  NUTRITION_MODEL,
  PROMPT,
  estimateNutrition,
  parseNutrition,
} from "../../src/lib/nutrition";

const probe = {
  async fetch(req: Request, env: { AI: Ai }) {
    const p = new URL(req.url).searchParams;

    /**
     * โหมดนี้เรียก estimateNutrition ของจริง — ได้ค่าที่จะถูกบันทึกลงฐานข้อมูล
     * ไม่ใช่แค่สิ่งที่โมเดลพูด (ซึ่งต่างกัน เพราะเราคูณจำนวนหน่วยเองในโค้ด)
     */
    const name = p.get("name");
    if (name) {
      const out = await estimateNutrition(env.AI, name, p.get("portion"));
      return Response.json({ name, portion: p.get("portion"), ...out });
    }

    const q = p.get("q");
    if (!q) {
      return new Response("ต้องมี ?q=<ชื่อเมนู+ปริมาณ> หรือ ?name=&portion=\n", { status: 400 });
    }

    const res = (await env.AI.run(NUTRITION_MODEL as keyof AiModels, {
      messages: [
        { role: "system", content: PROMPT },
        { role: "user", content: q },
      ],
      max_tokens: 200,
    } as never)) as { response?: string; choices?: { message?: { content?: string } }[] };

    const raw = res?.choices?.[0]?.message?.content ?? res?.response ?? null;
    return Response.json({ q, raw, parsed: parseNutrition(raw) });
  },
};

export default probe;
