import { MAX_COST_SATANG, parseBaht } from "@/lib/money";

/**
 * อ่านยอดรวมจากรูปใบเสร็จด้วย Workers AI
 *
 * ⚠️ ใบเสร็จโรงพยาบาลมีชื่อคนไข้และรายการรักษา = ข้อมูลสุขภาพ
 *
 * - ส่งไปแค่รูป รับกลับมาแค่ตัวเลข
 * - **ห้าม log รูป ข้อความที่โมเดลตอบ หรือ error ที่อาจพ่วงเนื้อหามา**
 *   หลักเดียวกับที่ห้าม log clientInput ใน safe-action
 * - เก็บลงฐานข้อมูลแค่ตัวเลขยอดรวม ไม่เก็บข้อความที่โมเดลตอบ
 *
 * ยอดที่อ่านได้เป็นแค่ "ค่าตั้งต้นให้ตรวจ" เสมอ ผู้ใช้ต้องเห็นและแก้ได้
 * ก่อนกลายเป็นค่าใช้จ่ายจริง — โมเดลอ่านผิดได้ โดยเฉพาะใบเสร็จถ่ายเอียงหรือซีด
 */

/**
 * ทำไมตัวนี้ ไม่ใช่ Gemma 4 หรือ Llama 3.2 Vision
 *
 * ทดสอบด้วยใบเสร็จภาษาไทยปลอมที่ใส่ตัวหลอกไว้ (รับเงิน 3,000 · ทอน 449.50 ·
 * ส่วนลดติดลบ) ยอดจริง 2,550.50 เมื่อ 14 ก.ย. 2569
 *
 * - Llama 4 Scout: อ่านถูก 1.7 วินาที ไม่มีขั้น reasoning มากินโทเคน
 * - Qwen 3.8: อ่านถูกเหมือนกัน แต่ช้ากว่าสามเท่า (5.2 วินาที)
 * - Gemma 4: ตอบกลับมาในชื่อ `...-external` ซึ่งเอกสารไม่ได้อธิบายว่าหมายถึงอะไร
 *   แต่ส่อว่าส่งต่อไปผู้ให้บริการภายนอก ไม่ใช้กับข้อมูลสุขภาพจนกว่าจะรู้แน่
 *   และใช้โทเคนไปกับการคิดจน max_tokens หมดโดยไม่ได้คำตอบ
 * - Llama 3.2 Vision: ต้องส่งคำว่า "agree" ยอมรับสัญญาของ Meta ในบัญชีก่อน
 *   ซึ่งเป็นการยอมรับสัญญาแทนเจ้าของบัญชี
 *
 * ถ้าจะเปลี่ยนโมเดล ต้องเรียกจริงดูชื่อที่ตอบกลับมาก่อนทุกครั้ง
 */
export const RECEIPT_MODEL = "@cf/meta/llama-4-scout-17b-16e-instruct";

const PROMPT =
  "อ่านใบเสร็จนี้ แล้วตอบเป็น JSON อย่างเดียว ไม่มีข้อความอื่น รูปแบบ " +
  '{"total": number|null} ' +
  "total คือยอดรวมสุทธิที่ต้องชำระจริงเป็นบาท หลังหักส่วนลดแล้ว " +
  "ไม่ใช่จำนวนเงินที่รับมา ไม่ใช่เงินทอน ไม่ใช่ราคารายการใดรายการหนึ่ง " +
  "ถ้ารูปนี้ไม่ใช่ใบเสร็จ หรืออ่านยอดรวมไม่ออก ให้ total เป็น null";

export type ReceiptRead =
  | { status: "read"; totalSatang: number }
  /** โมเดลตอบมาแล้ว แต่หายอดรวมไม่เจอหรือตัวเลขใช้ไม่ได้ */
  | { status: "not_found" }
  /** เรียกโมเดลไม่ได้เลย — ไม่มี binding (E2E), โควตาฟรีหมด, หรือ error */
  | { status: "unavailable" };

/**
 * แปลงคำตอบของโมเดลเป็นสตางค์
 *
 * โมเดลไม่ได้ตอบเป็น JSON เป๊ะเสมอ — เคยเห็นขึ้นบรรทัดว่างนำหน้า และโมเดลแนวนี้
 * ชอบห่อด้วย ```json ... ``` จึงต้องหา object ในข้อความก่อน parse
 *
 * ตัวเลขผ่าน parseBaht ตัวเดียวกับที่ช่องกรอกใช้ ไม่คูณ float เอง
 * (Number("0.07") * 100 ได้ 7.000000000000001)
 */
export function parseReceiptTotal(text: string | null | undefined): number | null {
  if (!text) return null;
  const match = text.match(/\{[\s\S]*?\}/);
  if (!match) return null;

  let raw: unknown;
  try {
    raw = (JSON.parse(match[0]) as { total?: unknown }).total;
  } catch {
    return null;
  }

  let asText: string;
  if (typeof raw === "number") {
    if (!Number.isFinite(raw) || raw <= 0) return null;
    // toFixed(2) ตัดทศนิยมเกินที่โมเดลบางทีตอบมา เช่น 2550.499999
    asText = raw.toFixed(2);
  } else if (typeof raw === "string") {
    asText = raw;
  } else {
    return null;
  }

  const satang = parseBaht(asText);
  // 0 บาทจากใบเสร็จแทบแน่นอนว่าอ่านผิด ไม่ใช่ไปมาแล้วไม่เสียเงิน
  if (typeof satang !== "number" || satang <= 0 || satang > MAX_COST_SATANG) return null;
  return satang;
}

/**
 * base64 ทีละก้อน
 *
 * String.fromCharCode(...bytes) ทีเดียวทั้งไฟล์ทำ stack ล้นกับรูปหลายร้อย KB
 * (spread ส่งทุกไบต์เป็น argument แยกกัน)
 */
export function toBase64(bytes: Uint8Array): string {
  let bin = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    bin += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(bin);
}

/**
 * เรียกโมเดลอ่านใบเสร็จ — **ไม่โยน error ออกไปเลย**
 *
 * การแนบใบเสร็จต้องสำเร็จได้แม้อ่านยอดไม่ได้ ผู้ใช้ยังกรอกเองได้
 * ถ้าปล่อยให้ error ของ AI ทำให้การแนบล้มด้วย จะเสียทั้งสองอย่าง
 *
 * รูปแบบการส่งรูปยืนยันจากการเรียกจริง ไม่ได้มาจากเอกสาร (เอกสารไม่ได้ระบุ):
 * `content` แบบ `image_url` + data URL ใช้ได้ ส่วนการใส่ไบต์ใน field `image`
 * **โมเดลมองไม่เห็นรูปเลยทั้งที่ไม่ error** — ถ้าเดาทางนั้นจะได้ null ทุกใบเงียบๆ
 */
export async function readReceiptTotal(
  ai: Ai | undefined,
  bytes: Uint8Array,
  mime: string,
): Promise<ReceiptRead> {
  if (!ai) return { status: "unavailable" };
  try {
    const res = (await ai.run(RECEIPT_MODEL as keyof AiModels, {
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "image_url", image_url: { url: `data:${mime};base64,${toBase64(bytes)}` } },
          ],
        },
      ],
      max_tokens: 120,
    } as never)) as {
      response?: string;
      choices?: { message?: { content?: string } }[];
    };
    const text = res?.choices?.[0]?.message?.content ?? res?.response ?? null;
    const totalSatang = parseReceiptTotal(text);
    return totalSatang == null ? { status: "not_found" } : { status: "read", totalSatang };
  } catch {
    // ไม่ log: error จาก AI อาจพ่วงเนื้อหาคำขอมาด้วย
    // โควตาฟรีรายวันหมดก็มาทางนี้ — ผู้ใช้กรอกเองได้ ไม่ใช่เรื่องที่ต้องล้ม
    return { status: "unavailable" };
  }
}
