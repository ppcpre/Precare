import { describe, expect, it } from "vitest";
import { RECEIPT_MODEL, parseReceiptTotal, readReceiptTotal, toBase64 } from "@/lib/receipt";

describe("parseReceiptTotal — แปลงคำตอบของโมเดลเป็นสตางค์", () => {
  it("คำตอบจริงที่ได้จาก Llama 4 Scout ตอนทดสอบ", () => {
    expect(parseReceiptTotal('{"total": 2550.5}')?.totalSatang).toBe(255050);
  });

  it("คำตอบจริงที่ได้จาก Qwen ตอนทดสอบ — มีบรรทัดว่างนำหน้า", () => {
    expect(parseReceiptTotal('\n\n{"total": 2550.50}')?.totalSatang).toBe(255050);
  });

  it("โมเดลห่อด้วย code fence", () => {
    expect(parseReceiptTotal('```json\n{"total": 1200}\n```')?.totalSatang).toBe(120000);
  });

  it("ตัวเลขเป็นข้อความที่มีจุลภาค", () => {
    expect(parseReceiptTotal('{"total": "2,550.50"}')?.totalSatang).toBe(255050);
  });

  /** ทศนิยมลอยของ float — ต้องไม่ได้ 255049 หรือ 255050.00000001 */
  it("ทศนิยมเพี้ยนจาก float ต้องปัดเป็นสตางค์ที่ถูก", () => {
    expect(parseReceiptTotal('{"total": 2550.4999999}')?.totalSatang).toBe(255050);
    expect(parseReceiptTotal('{"total": 0.07}')?.totalSatang).toBe(7);
  });

  it("อ่านไม่ออก = null ไม่ใช่ 0", () => {
    expect(parseReceiptTotal('{"total": null}')).toBeNull();
  });

  /** 0 บาทจากใบเสร็จแทบแน่นอนว่าอ่านผิด ถ้าเติม 0 ลงช่องจะอ่านได้ว่า "ไม่เสียเงิน" */
  it("ศูนย์และติดลบถือว่าอ่านไม่ได้", () => {
    expect(parseReceiptTotal('{"total": 0}')).toBeNull();
    expect(parseReceiptTotal('{"total": -100}')).toBeNull();
  });

  it("ตัวเลขเกินเพดานค่าใช้จ่ายต่อนัดถือว่าอ่านผิด", () => {
    expect(parseReceiptTotal('{"total": 99999999}')).toBeNull();
  });

  it("ข้อความที่ไม่มี JSON หรือ JSON พัง ต้องไม่โยน error", () => {
    expect(parseReceiptTotal("ยอดรวมคือ 2,550.50 บาท")).toBeNull();
    expect(parseReceiptTotal("{total: 2550}")).toBeNull();
    expect(parseReceiptTotal("")).toBeNull();
    expect(parseReceiptTotal(null)).toBeNull();
  });

  it("ชนิดข้อมูลแปลกๆ", () => {
    expect(parseReceiptTotal('{"total": true}')).toBeNull();
    expect(parseReceiptTotal('{"total": [2550]}')).toBeNull();
    expect(parseReceiptTotal('{"total": "abc"}')).toBeNull();
  });
});

describe("toBase64", () => {
  it("ตรงกับ btoa ทั้งไฟล์สำหรับข้อมูลเล็ก", () => {
    const bytes = new Uint8Array([0, 1, 2, 250, 255, 128]);
    expect(toBase64(bytes)).toBe(btoa(String.fromCharCode(...bytes)));
  });

  /** spread ทั้งไฟล์ทีเดียวทำ stack ล้นกับรูปหลายร้อย KB — ต้องทำทีละก้อน */
  it("ไฟล์ขนาดรูปใบเสร็จจริงต้องไม่ทำ stack ล้น และถอดกลับได้ครบ", () => {
    const bytes = new Uint8Array(600_000).map((_, i) => (i * 31) % 256);
    const b64 = toBase64(bytes);
    const back = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
    expect(back.length).toBe(bytes.length);
    expect(back[599_999]).toBe(bytes[599_999]);
  });
});

describe("readReceiptTotal — ห้ามทำให้การแนบใบเสร็จล้ม", () => {
  const img = new Uint8Array([1, 2, 3]);

  it("ไม่มี AI binding (E2E ที่รันด้วย --local) = unavailable", async () => {
    expect(await readReceiptTotal(undefined, img, "image/webp")).toEqual({ status: "unavailable" });
  });

  it("AI โยน error (เช่นโควตาฟรีรายวันหมด) = unavailable ไม่ใช่ throw", async () => {
    const ai = { run: async () => { throw new Error("4006: daily free allocation exceeded"); } };
    expect(await readReceiptTotal(ai as never, img, "image/webp")).toEqual({ status: "unavailable" });
  });

  it("ส่งรูปแบบ image_url ด้วย data URL และใช้โมเดลที่กำหนด", async () => {
    let captured: { model?: string; body?: unknown } = {};
    const ai = {
      run: async (model: string, body: unknown) => {
        captured = { model, body };
        return { choices: [{ message: { content: '{"total": 350.5}' } }] };
      },
    };
    const res = await readReceiptTotal(ai as never, img, "image/webp");
    expect(res).toEqual({ status: "read", totalSatang: 35050, verified: null });
    expect(captured.model).toBe(RECEIPT_MODEL);

    // การใส่ไบต์ใน field `image` ทำให้โมเดลมองไม่เห็นรูปเลยทั้งที่ไม่ error
    // (ยืนยันจากการเรียกจริง) เทสต์นี้กันไม่ให้ใครเปลี่ยนกลับไปทางนั้น
    const content = (captured.body as { messages: { content: { type: string; image_url?: { url: string } }[] }[] })
      .messages[0].content;
    const image = content.find((c) => c.type === "image_url");
    expect(image?.image_url?.url.startsWith("data:image/webp;base64,")).toBe(true);
    expect(captured.body).not.toHaveProperty("image");
  });

  it("โมเดลตอบแต่หายอดไม่เจอ = not_found", async () => {
    const ai = { run: async () => ({ choices: [{ message: { content: '{"total": null}' } }] }) };
    expect(await readReceiptTotal(ai as never, img, "image/webp")).toEqual({ status: "not_found" });
  });

  it("รองรับคำตอบรูปแบบเก่าที่อยู่ใน field response", async () => {
    const ai = { run: async () => ({ response: '{"total": 800}' }) };
    expect(await readReceiptTotal(ai as never, img, "image/webp")).toEqual({
      status: "read", totalSatang: 80000, verified: null,
    });
  });

  it("ไม่ใช้โมเดลที่ตอบกลับมาในชื่อ external", () => {
    expect(RECEIPT_MODEL).not.toContain("gemma-4");
    expect(RECEIPT_MODEL.startsWith("@cf/")).toBe(true);
  });
});

describe("ตัวตรวจสอบ: รายการย่อยต้องบวกกันได้เท่ายอดรวม", () => {
  /**
   * มีเพราะวัดมาแล้วว่าโมเดลตอบเลขผิดอย่างมั่นใจได้ และผิดซ้ำเดิมทุกรอบ
   * ตัวเลขที่ขัดกันเองคือสัญญาณเดียวที่เรามีว่าน่าจะอ่านพลาด
   */
  it("บวกกันได้เท่ายอดรวม = ผ่าน", () => {
    expect(parseReceiptTotal('{"items":[4000,441.14],"total":4441.14}')).toEqual({
      totalSatang: 444114, verified: true,
    });
  });

  it("บวกกันไม่เท่า = ยังอ่านได้ แต่ติดธงว่าไม่สอดคล้อง", () => {
    // เคสจริงที่เจอ: total อ่านเป็น 4,755.14 ทั้งที่รายการย่อยรวมได้ 4,441.14
    expect(parseReceiptTotal('{"items":[4000,441.14],"total":4755.14}')).toEqual({
      totalSatang: 475514, verified: false,
    });
  });

  it("ไม่มีรายการย่อยให้เทียบ = ไม่สรุปว่าผิด", () => {
    expect(parseReceiptTotal('{"items":[],"total":411.41}')?.verified).toBeNull();
    expect(parseReceiptTotal('{"total":411.41}')?.verified).toBeNull();
  });

  it("รายการย่อยมีบรรทัดที่อ่านไม่ได้ = สรุปไม่ได้ ไม่ใช่ตัดสินว่าผิด", () => {
    expect(parseReceiptTotal('{"items":[4000,"?"],"total":4441.14}')?.verified).toBeNull();
  });

  /** ทศนิยมลอยของ float — 341.10 + 100 ต้องได้ 441.10 พอดี ไม่ใช่ 441.09999 */
  it("บวกบนสตางค์ ไม่ใช่บน float", () => {
    expect(parseReceiptTotal('{"items":[341.10,100],"total":441.10}')?.verified).toBe(true);
    expect(parseReceiptTotal('{"items":[941.41,200],"total":1141.41}')?.verified).toBe(true);
  });
});
