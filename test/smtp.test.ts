import { describe, expect, it } from "vitest";
import {
  SmtpError,
  buildMessage,
  encodeHeader,
  sendViaSmtp,
  type SmtpConnect,
  type SmtpSocket,
} from "@/lib/smtp";

/**
 * ตัวปลอมของ socket — เก็บทุกบรรทัดที่เราส่ง และป้อนคำตอบตามคิวที่กำหนด
 *
 * ทำแบบนี้เพื่อทดสอบบทสนทนา SMTP ทั้งชุดโดยไม่ต้องต่อเน็ตจริง ซึ่งจำเป็นมาก
 * เพราะเส้นทางนี้ทำงานเฉพาะตอนมีคนลืมรหัสผ่าน ถ้าพังจะไม่มีใครรู้จนกว่าจะสาย
 */
function fakeSocket(replies: string[]) {
  const sent: string[] = [];
  const queue = [...replies];
  const enc = new TextEncoder();
  const dec = new TextDecoder();

  const make = (): SmtpSocket => ({
    readable: new ReadableStream<Uint8Array>({
      pull(c) {
        const next = queue.shift();
        if (next === undefined) return c.close();
        c.enqueue(enc.encode(next));
      },
    }),
    writable: new WritableStream<Uint8Array>({
      write(chunk) {
        sent.push(dec.decode(chunk));
      },
    }),
    startTls: () => make(),
    close: async () => {},
  });

  let opts: unknown = null;
  const connect: SmtpConnect = (_addr, o) => {
    opts = o;
    return make();
  };
  return { connect, sent, optsUsed: () => opts };
}

const OK_FLOW = [
  "220 smtp.gmail.com ESMTP\r\n",
  "250-smtp.gmail.com\r\n250 STARTTLS\r\n",
  "220 2.0.0 Ready to start TLS\r\n",
  "250-smtp.gmail.com\r\n250 AUTH LOGIN\r\n",
  "334 VXNlcm5hbWU6\r\n",
  "334 UGFzc3dvcmQ6\r\n",
  "235 2.7.0 Accepted\r\n",
  "250 2.1.0 OK\r\n",
  "250 2.1.5 OK\r\n",
  "354 Go ahead\r\n",
  "250 2.0.0 OK queued\r\n",
];

const cfg = { host: "smtp.gmail.com", port: 587, user: "app@gmail.com", pass: "app-password" };
const mail = {
  fromName: "Pre Care",
  to: "mom@example.com",
  subject: "ตั้งรหัสผ่านใหม่",
  html: "<p>ลิงก์</p>",
  text: "ลิงก์",
};

describe("ประกอบตัวอีเมล", () => {
  it("หัวข้อภาษาไทยเข้ารหัสแบบ RFC 2047 ไม่ส่ง UTF-8 ดิบ", () => {
    const h = encodeHeader("ตั้งรหัสผ่านใหม่");
    expect(h).toMatch(/^=\?UTF-8\?B\?[A-Za-z0-9+/=]+\?=$/);
    expect(buildMessage("app@gmail.com", mail)).toContain(`Subject: ${h}`);
  });

  it("มีทั้งข้อความธรรมดาและ html อยู่ในฉบับเดียว", () => {
    const msg = buildMessage("app@gmail.com", mail);
    expect(msg).toContain("multipart/alternative");
    expect(msg).toContain("text/plain; charset=UTF-8");
    expect(msg).toContain("text/html; charset=UTF-8");
  });

  /**
   * บรรทัดที่ขึ้นต้นด้วยจุดจะถูก SMTP ตีความว่าจบข้อความ และบรรทัดยาวเกิน
   * 998 ตัวอักษรผิดสเปก — base64 ที่ตัดทุก 76 ตัวกันได้ทั้งสองอย่าง
   */
  it("เนื้อหาเป็น base64 ตัดบรรทัด ไม่มีบรรทัดไหนขึ้นต้นด้วยจุด", () => {
    const long = { ...mail, text: "ก".repeat(5000), html: `<p>${"ข".repeat(5000)}</p>` };
    const msg = buildMessage("app@gmail.com", long);
    for (const line of msg.split("\r\n")) {
      expect(line.startsWith(".")).toBe(false);
      expect(line.length).toBeLessThanOrEqual(998);
    }
  });
});

describe("บทสนทนา SMTP", () => {
  it("เดินครบขั้นตอนและส่งสำเร็จ", async () => {
    const f = fakeSocket(OK_FLOW);
    await sendViaSmtp(cfg, mail, f.connect);

    const convo = f.sent.join("");
    expect(convo).toContain("EHLO smtp.gmail.com");
    expect(convo).toContain("STARTTLS");
    expect(convo).toContain("AUTH LOGIN");
    expect(convo).toContain("MAIL FROM:<app@gmail.com>");
    expect(convo).toContain("RCPT TO:<mom@example.com>");
    expect(convo).toContain("DATA");
    expect(convo).toContain("\r\n.\r\n");
    expect(convo).toContain("QUIT");
  });

  /** บั๊กที่เจอจริงตอนทดลอง: ถ้าไม่ประกาศตั้งแต่เปิด socket startTls() จะใช้ไม่ได้ */
  it("เปิด socket ด้วย secureTransport: starttls เสมอ", async () => {
    const f = fakeSocket(OK_FLOW);
    await sendViaSmtp(cfg, mail, f.connect);
    expect(f.optsUsed()).toEqual({ secureTransport: "starttls", allowHalfOpen: false });
  });

  it("รหัสผ่านผิด = โยน SmtpError ที่บอกว่าพังตอนไหน", async () => {
    const flow = [...OK_FLOW];
    flow[6] = "535 5.7.8 Username and Password not accepted\r\n";
    const f = fakeSocket(flow);
    await expect(sendViaSmtp(cfg, mail, f.connect)).rejects.toMatchObject({
      name: "SmtpError",
      step: "auth-pass",
      code: 535,
    });
  });

  /** บางเซิร์ฟเวอร์สะท้อนอีเมลผู้รับกลับมาในข้อความ error — ห้ามติดไปกับ error ของเรา */
  it("ข้อความ error ต้องไม่มีอีเมลผู้รับติดไปด้วย", async () => {
    const flow = [...OK_FLOW];
    flow[8] = "550 5.1.1 The email account mom@example.com does not exist\r\n";
    const f = fakeSocket(flow);
    const err = await sendViaSmtp(cfg, mail, f.connect).catch((e: SmtpError) => e);
    expect(err).toBeInstanceOf(SmtpError);
    expect((err as SmtpError).message).not.toContain("mom@example.com");
  });

  it("เซิร์ฟเวอร์ตอบหลายบรรทัดต้องอ่านจนจบชุด ไม่ใช่หยุดที่บรรทัดแรก", async () => {
    const flow = [...OK_FLOW];
    flow[1] = "250-smtp.gmail.com at your service\r\n250-SIZE 35882577\r\n250 STARTTLS\r\n";
    const f = fakeSocket(flow);
    await expect(sendViaSmtp(cfg, mail, f.connect)).resolves.toBeUndefined();
  });
});
