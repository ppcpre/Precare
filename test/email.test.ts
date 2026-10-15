import { describe, expect, it, vi } from "vitest";
import { buildPayload, resetPasswordMail, sendEmail } from "@/lib/email";

const env = {
  BREVO_API_KEY: "key-123",
  BREVO_SENDER: "no-reply@example.com",
  BREVO_SENDER_NAME: "Pre Care",
};
const mail = { to: "mom@example.com", subject: "หัวข้อ", html: "<p>เนื้อ</p>", text: "เนื้อ" };

describe("ส่งอีเมลผ่าน Brevo", () => {
  it("ประกอบ body ตามชื่อฟิลด์ที่ Brevo กำหนด", () => {
    expect(buildPayload(env, mail)).toEqual({
      sender: { email: "no-reply@example.com", name: "Pre Care" },
      to: [{ email: "mom@example.com" }],
      subject: "หัวข้อ",
      htmlContent: "<p>เนื้อ</p>",
      textContent: "เนื้อ",
    });
  });

  it("ส่งด้วย header api-key และ endpoint ที่ถูกต้อง", async () => {
    const f = vi.fn().mockResolvedValue(new Response("{}", { status: 201 }));
    expect(await sendEmail(env, mail, f as unknown as typeof fetch)).toEqual({ status: "sent" });

    const [url, init] = f.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.brevo.com/v3/smtp/email");
    expect((init.headers as Record<string, string>)["api-key"]).toBe("key-123");
  });

  /** ยังไม่ได้ตั้ง secret ไม่ใช่ข้อผิดพลาด — ระบบต้องเดินต่อได้ ไม่ใช่ล้มทั้งคำขอ */
  it("ไม่มีคีย์ = not_configured และต้องไม่ยิงเน็ตเลย", async () => {
    const f = vi.fn();
    expect(await sendEmail({}, mail, f as unknown as typeof fetch)).toEqual({
      status: "not_configured",
    });
    expect(f).not.toHaveBeenCalled();
  });

  it("Brevo ตอบไม่ผ่าน = บอกรหัสสถานะกลับไป", async () => {
    const f = vi.fn().mockResolvedValue(new Response("nope", { status: 401 }));
    expect(await sendEmail(env, mail, f as unknown as typeof fetch)).toEqual({
      status: "failed",
      code: 401,
      reason: null,
    });
  });

  it("อีเมลรีเซ็ตมีลิงก์ บอกอายุ และบอกว่าถ้าไม่ได้ขอเองไม่ต้องทำอะไร", () => {
    const m = resetPasswordMail("https://precare.test/reset?token=abc", 60);
    expect(m.text).toContain("https://precare.test/reset?token=abc");
    expect(m.text).toContain("60 นาที");
    expect(m.text).toContain("ไม่ได้เป็นคนขอเอง");
    expect(m.html).toContain("https://precare.test/reset?token=abc");
  });

  /** ถ้าไม่เก็บเหตุผลไว้ เวลาส่งไม่ออกจะบอกไม่ได้ว่าคีย์ผิดหรือผู้ส่งยังไม่ยืนยัน */
  it("เก็บรหัสเหตุผลของ Brevo ไว้ด้วย แต่ไม่เอาข้อความทั้งก้อน", async () => {
    const body = JSON.stringify({ code: "unauthorized", message: "Key not found: mom@x.com" });
    const f = vi.fn().mockResolvedValue(new Response(body, { status: 401 }));
    const res = await sendEmail(env, mail, f as unknown as typeof fetch);
    expect(res).toEqual({ status: "failed", code: 401, reason: "unauthorized" });
    expect(JSON.stringify(res)).not.toContain("mom@x.com");
  });
});
