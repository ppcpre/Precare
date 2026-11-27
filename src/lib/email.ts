/**
 * ส่งอีเมลผ่าน Brevo (HTTP API)
 *
 * ทำไมไม่ใช้ SMTP: Workers ต่อ SMTP ได้จริง (ทดสอบแล้วใน scripts/smtp-probe —
 * ต้องเปิด socket ด้วย `secureTransport: "starttls"` ไม่งั้น startTls() ใช้ไม่ได้)
 * แต่ App Password ของ Gmail คือกุญแจเข้าบัญชีทั้งใบผ่าน SMTP/IMAP ถ้าหลุดคือ
 * หลุดทั้งบัญชี ส่วนคีย์ของ Brevo ทำได้อย่างเดียวคือส่งอีเมล
 *
 * ไม่ต้องมีโดเมนของตัวเอง — Brevo ยืนยันแค่อีเมลผู้ส่งรายตัวได้
 */
import { SmtpError, sendViaSmtp, type SmtpConnect } from "@/lib/smtp";

const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

/**
 * โหลด `connect` จาก cloudflare:sockets ตอนใช้งานจริงเท่านั้น
 *
 * import ตรงๆ ที่หัวไฟล์ไม่ได้ เพราะโมดูลนี้ถูกดึงเข้าไปในเทสต์ที่รันนอก workerd ด้วย
 */
async function loadSocketConnect(): Promise<SmtpConnect | null> {
  try {
    /**
     * turbopackIgnore/webpackIgnore: ปล่อยให้ runtime เป็นคนหาเอง
     *
     * `cloudflare:sockets` มีอยู่จริงเฉพาะตอนรันบน workerd — ถ้าปล่อยให้
     * bundler ไปตามหาตอน build มันจะหาไม่เจอแล้ว build ล้มทั้งแอป
     * (เจอจริง: "Could not resolve cloudflare:sockets")
     */
    const mod = (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ "cloudflare:sockets"
    )) as { connect?: unknown };
    return (mod.connect as SmtpConnect) ?? null;
  } catch {
    return null;
  }
}

export interface EmailEnv {
  /** บัญชี Gmail ของแอป (ไม่ใช่บัญชีส่วนตัว) + App Password */
  GMAIL_USER?: string;
  GMAIL_APP_PASSWORD?: string;

  BREVO_API_KEY?: string;
  /** อีเมลผู้ส่งที่ยืนยันกับ Brevo ไว้แล้ว */
  BREVO_SENDER?: string;
  BREVO_SENDER_NAME?: string;
}

const SENDER_NAME = "Pre Care";

export interface Mail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export type SendResult =
  | { status: "sent" }
  /** ยังไม่ได้ตั้ง secret — ไม่ใช่ข้อผิดพลาด ระบบต้องเดินต่อได้ */
  | { status: "not_configured" }
  /**
   * `code` คือ HTTP status ส่วน `reason` คือฟิลด์ `code` ของ Brevo เอง
   * (เช่น `unauthorized`, `invalid_parameter`) ซึ่งเป็นค่าสั้นๆ ไม่มีข้อมูลผู้ใช้
   *
   * ต้องมีทั้งคู่ ไม่งั้นเวลาส่งไม่ออกจะบอกไม่ได้ว่าคีย์ผิดหรือผู้ส่งยังไม่ยืนยัน
   * — เจอมาแล้วตอนตั้งค่าครั้งแรก log บอกแค่ "failed" แล้วต้องเดาเอง
   */
  | { status: "failed"; code: number; reason: string | null };

/**
 * ประกอบ body ตามสัญญาของ Brevo — แยกออกมาเพื่อเทสต์ได้โดยไม่ต้องยิงเน็ตจริง
 * (ชื่อฟิลด์มาจากเอกสาร POST /v3/smtp/email)
 */
export function buildPayload(env: EmailEnv, mail: Mail) {
  return {
    sender: { email: env.BREVO_SENDER, name: env.BREVO_SENDER_NAME ?? SENDER_NAME },
    to: [{ email: mail.to }],
    subject: mail.subject,
    htmlContent: mail.html,
    textContent: mail.text,
  };
}

/**
 * ส่งอีเมลหนึ่งฉบับ — เลือกช่องทางจาก secret ที่ตั้งไว้
 *
 * Gmail มาก่อนเพราะส่งถึงปลายทางได้จริงกว่า: อีเมลออกจากเซิร์ฟเวอร์ของ Gmail
 * และถูกเซ็นด้วย gmail.com ส่วนบริการส่งแทนที่ใช้อีเมลฟรีเป็นผู้ส่ง จะถูก
 * Gmail/Yahoo/Outlook ปฏิเสธตั้งแต่ปี 2024 เพราะ SPF/DKIM ไม่ตรงกับโดเมน
 *
 * Brevo ยังเก็บไว้เป็นทางที่สอง — วันที่มีโดเมนของตัวเองแล้วจะกลับมาใช้ได้ทันที
 * โดยไม่ต้องเขียนอะไรใหม่
 */
export async function sendEmail(
  env: EmailEnv,
  mail: Mail,
  fetchImpl: typeof fetch = fetch,
  connectImpl?: SmtpConnect,
): Promise<SendResult> {
  if (env.GMAIL_USER && env.GMAIL_APP_PASSWORD) {
    const connect = connectImpl ?? (await loadSocketConnect());
    if (!connect) return { status: "not_configured" };
    try {
      await sendViaSmtp(
        { host: "smtp.gmail.com", port: 587, user: env.GMAIL_USER, pass: env.GMAIL_APP_PASSWORD },
        { fromName: SENDER_NAME, to: mail.to, subject: mail.subject, html: mail.html, text: mail.text },
        connect,
      );
      return { status: "sent" };
    } catch (e) {
      // ข้อความของ SmtpError ไม่มีอีเมลผู้รับอยู่แล้ว (ดู lib/smtp.ts)
      const step = e instanceof SmtpError ? e.step : "smtp";
      const code = e instanceof SmtpError ? e.code : 0;
      return { status: "failed", code, reason: step };
    }
  }

  if (!env.BREVO_API_KEY || !env.BREVO_SENDER) return { status: "not_configured" };

  const res = await fetchImpl(ENDPOINT, {
    method: "POST",
    headers: { "api-key": env.BREVO_API_KEY, "content-type": "application/json" },
    body: JSON.stringify(buildPayload(env, mail)),
  });

  /**
   * ไม่ log เนื้อหาอีเมลหรือคำตอบของ Brevo
   *
   * อีเมลของผู้ใช้เป็นข้อมูลส่วนบุคคล และลิงก์รีเซ็ตที่อยู่ในเนื้อหาคือกุญแจ
   * เข้าบัญชี — log ไว้เมื่อไหร่ก็เท่ากับเก็บกุญแจไว้ในที่ที่ไม่ได้ตั้งใจ
   */
  if (res.ok) return { status: "sent" };

  // อ่านเฉพาะฟิลด์ code ของ Brevo ไม่เอา message ทั้งก้อน เพราะอาจมีอีเมลผู้รับอยู่ในนั้น
  let reason: string | null = null;
  try {
    const body = (await res.json()) as { code?: unknown };
    if (typeof body.code === "string") reason = body.code.slice(0, 60);
  } catch {
    // ตอบไม่ใช่ JSON — ไม่เป็นไร รหัส HTTP ก็บอกอะไรได้แล้ว
  }
  return { status: "failed", code: res.status, reason };
}

/** เนื้อหาอีเมลรีเซ็ตรหัสผ่าน — ข้อความเดียว ใช้ทั้ง html และ text */
export function resetPasswordMail(url: string, minutes: number): Omit<Mail, "to"> {
  const subject = "ตั้งรหัสผ่านใหม่ของ Pre Care";
  const lines = [
    "มีการขอตั้งรหัสผ่านใหม่สำหรับบัญชี Pre Care ของคุณ",
    `กดลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (ใช้ได้ครั้งเดียว ภายใน ${minutes} นาที)`,
    url,
    "ถ้าไม่ได้เป็นคนขอเอง ไม่ต้องทำอะไร รหัสผ่านเดิมยังใช้ได้ตามปกติ",
  ];
  return {
    subject,
    text: lines.join("\n\n"),
    html: `<div style="font-family:system-ui,sans-serif;line-height:1.7;color:#2B2420">
<p>${lines[0]}</p>
<p>${lines[1]}</p>
<p><a href="${url}" style="color:#6B4F3F">${url}</a></p>
<p style="color:#6B6560;font-size:14px">${lines[3]}</p>
</div>`,
  };
}
