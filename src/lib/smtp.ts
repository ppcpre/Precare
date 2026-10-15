/**
 * ตัวส่งอีเมลผ่าน SMTP บน Cloudflare Workers
 *
 * เขียนเองเพราะไลบรารี SMTP ทั่วไปพึ่ง `node:net`/`node:tls` ซึ่ง Workers ไม่มี
 * — ที่ใช้ได้คือ `cloudflare:sockets` ซึ่งพิสูจน์แล้วว่าคุยกับ smtp.gmail.com
 * ได้จริงทั้งบนเครื่องและบน edge (ดู scripts/smtp-probe/)
 *
 * **กุญแจสำคัญ**: ต้องเปิด socket ด้วย `secureTransport: "starttls"` ตั้งแต่แรก
 * ไม่งั้น `startTls()` จะโยน TypeError ทิ้ง ไม่ใช่เพราะเซิร์ฟเวอร์ไม่รองรับ
 *
 * ทำไมไม่ส่งผ่านผู้ให้บริการอีเมล: บริการพวกนั้นส่งแทนเราในนามอีเมลของเรา
 * ซึ่ง Gmail/Yahoo/Outlook ปฏิเสธตั้งแต่ปี 2024 ถ้าโดเมนผู้ส่งเป็นอีเมลฟรี
 * (SPF/DKIM ไม่ตรงกับ gmail.com) แต่การส่งผ่าน SMTP ของ Gmail เอง อีเมลออกจาก
 * เซิร์ฟเวอร์ของ Gmail จริงและถูกเซ็นด้วย gmail.com จึงไม่ติดปัญหานี้
 */

/** ส่วนของ socket ที่เราใช้จริง — แคบไว้เพื่อให้ใส่ตัวปลอมในเทสต์ได้ */
export interface SmtpSocket {
  readable: ReadableStream<Uint8Array>;
  writable: WritableStream<Uint8Array>;
  startTls(): SmtpSocket;
  close(): Promise<void>;
}

export type SmtpConnect = (
  address: { hostname: string; port: number },
  options: { secureTransport: "starttls"; allowHalfOpen: false },
) => SmtpSocket;

export interface SmtpConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SmtpMessage {
  fromName: string;
  to: string;
  subject: string;
  html: string;
  text: string;
}

const enc = new TextEncoder();
const dec = new TextDecoder();

/** base64 ของข้อความ UTF-8 — btoa รับได้แค่ไบต์ จึงต้องแปลงเองก่อน */
export function b64(s: string): string {
  const bytes = enc.encode(s);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin);
}

/**
 * หัวข้ออีเมลภาษาไทยต้องเข้ารหัสตาม RFC 2047
 * ถ้าใส่ UTF-8 ดิบลงไป ปลายทางจะเห็นเป็นตัวขยะ
 */
export const encodeHeader = (s: string) => `=?UTF-8?B?${b64(s)}?=`;

/**
 * ประกอบตัวอีเมลตาม MIME — แยกออกมาให้เทสต์ได้โดยไม่ต้องต่อเน็ต
 *
 * ใช้ base64 ทั้ง body เพื่อเลี่ยงสองกับดักพร้อมกัน: บรรทัดยาวเกิน 998 ตัวอักษร
 * ซึ่งผิดสเปก และบรรทัดที่ขึ้นต้นด้วยจุดซึ่งจะถูกตีความว่าจบข้อความ
 */
export function buildMessage(from: string, m: SmtpMessage): string {
  const boundary = `b${b64(`${m.to}${m.subject}`).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24)}`;
  const wrap = (s: string) => b64(s).replace(/(.{76})/g, "$1\r\n");

  return [
    `From: ${encodeHeader(m.fromName)} <${from}>`,
    `To: ${m.to}`,
    `Subject: ${encodeHeader(m.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(m.text),
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    wrap(m.html),
    `--${boundary}--`,
    "",
  ].join("\r\n");
}

/** อ่านคำตอบหนึ่งชุดของ SMTP — ชุดหนึ่งมีได้หลายบรรทัด จบที่ "250 " ไม่ใช่ "250-" */
async function readReply(reader: ReadableStreamDefaultReader<Uint8Array>): Promise<string> {
  let buf = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) return buf;
    buf += dec.decode(value, { stream: true });
    const lines = buf.split("\r\n").filter(Boolean);
    const last = lines.at(-1) ?? "";
    if (/^\d{3} /.test(last)) return buf;
  }
}

const codeOf = (reply: string) => Number(reply.slice(0, 3));

export class SmtpError extends Error {
  constructor(
    readonly step: string,
    readonly code: number,
  ) {
    // ไม่เอาข้อความจากเซิร์ฟเวอร์มาด้วย — บางเซิร์ฟเวอร์สะท้อนอีเมลผู้รับกลับมา
    super(`SMTP ${step} ตอบ ${code}`);
    this.name = "SmtpError";
  }
}

/**
 * ส่งอีเมลหนึ่งฉบับ
 *
 * เปิด-ปิดการเชื่อมต่อต่อหนึ่งฉบับ ไม่ทำ connection pool — เราส่งนานๆ ครั้ง
 * (ลืมรหัสผ่าน/คำเชิญ) และ worker มีอายุสั้น การถือ connection ไว้ไม่ได้ช่วยอะไร
 */
export async function sendViaSmtp(
  cfg: SmtpConfig,
  m: SmtpMessage,
  connect: SmtpConnect,
): Promise<void> {
  const socket = connect(
    { hostname: cfg.host, port: cfg.port },
    { secureTransport: "starttls", allowHalfOpen: false },
  );

  let reader = socket.readable.getReader();
  let writer = socket.writable.getWriter();
  const say = async (line: string) => writer.write(enc.encode(`${line}\r\n`));

  const expect = async (step: string, ...ok: number[]) => {
    const code = codeOf(await readReply(reader));
    if (!ok.includes(code)) throw new SmtpError(step, code);
  };

  try {
    await expect("greeting", 220);
    await say(`EHLO ${cfg.host}`);
    await expect("ehlo", 250);

    await say("STARTTLS");
    await expect("starttls", 220);

    // ต้องปล่อย lock ก่อนยกระดับเป็น TLS ไม่งั้น stream ใหม่ใช้ไม่ได้
    reader.releaseLock();
    writer.releaseLock();
    const secure = socket.startTls();
    reader = secure.readable.getReader();
    writer = secure.writable.getWriter();

    await say(`EHLO ${cfg.host}`);
    await expect("ehlo-tls", 250);

    await say("AUTH LOGIN");
    await expect("auth", 334);
    await say(b64(cfg.user));
    await expect("auth-user", 334);
    await say(b64(cfg.pass));
    await expect("auth-pass", 235);

    await say(`MAIL FROM:<${cfg.user}>`);
    await expect("mail-from", 250);
    await say(`RCPT TO:<${m.to}>`);
    await expect("rcpt-to", 250, 251);
    await say("DATA");
    await expect("data", 354);

    await say(buildMessage(cfg.user, m));
    await say(".");
    await expect("body", 250);

    await say("QUIT");
  } finally {
    // ปิดเสมอ แม้ล้มกลางทาง ไม่งั้นการเชื่อมต่อค้างจนกว่า worker จะตาย
    try {
      await socket.close();
    } catch {
      // ปิดไม่ได้ก็ไม่เป็นไร ของสำคัญคือผลการส่งซึ่งรู้ไปแล้ว
    }
  }
}
