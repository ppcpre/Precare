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
const ENDPOINT = "https://api.brevo.com/v3/smtp/email";

export interface EmailEnv {
  BREVO_API_KEY?: string;
  /** อีเมลผู้ส่งที่ยืนยันกับ Brevo ไว้แล้ว */
  BREVO_SENDER?: string;
  BREVO_SENDER_NAME?: string;
}

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
  | { status: "failed"; code: number };

/**
 * ประกอบ body ตามสัญญาของ Brevo — แยกออกมาเพื่อเทสต์ได้โดยไม่ต้องยิงเน็ตจริง
 * (ชื่อฟิลด์มาจากเอกสาร POST /v3/smtp/email)
 */
export function buildPayload(env: EmailEnv, mail: Mail) {
  return {
    sender: { email: env.BREVO_SENDER, name: env.BREVO_SENDER_NAME ?? "Pre Care" },
    to: [{ email: mail.to }],
    subject: mail.subject,
    htmlContent: mail.html,
    textContent: mail.text,
  };
}

export async function sendEmail(
  env: EmailEnv,
  mail: Mail,
  fetchImpl: typeof fetch = fetch,
): Promise<SendResult> {
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
  return res.ok ? { status: "sent" } : { status: "failed", code: res.status };
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
