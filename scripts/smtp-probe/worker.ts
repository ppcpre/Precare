/**
 * ทดสอบว่า Cloudflare Workers ต่อ SMTP ของ Gmail ได้จริงไหม
 *
 * คำถามที่ตอบ: `cloudflare:sockets` + `startTls()` ใช้กับ smtp.gmail.com:587
 * ได้หรือเปล่า — มีรายงานบั๊กว่า startTls หลังจาก EHLO แล้วอ่าน/เขียนต่อไม่ได้
 *
 * ไม่ต้องใช้รหัสผ่านใดๆ เพราะหยุดก่อนขั้นตอน AUTH — แค่ดูว่า handshake ผ่านไหม
 */
import { connect } from "cloudflare:sockets";

const probe = {
  async fetch(): Promise<Response> {
    const log: string[] = [];
    const t0 = Date.now();
    const at = () => `${String(Date.now() - t0).padStart(5)}ms`;

    try {
      const socket = connect(
        { hostname: "smtp.gmail.com", port: 587 },
        // ต้องประกาศตั้งแต่เปิด socket ไม่งั้น startTls() ใช้ไม่ได้
        { secureTransport: "starttls", allowHalfOpen: false },
      );
      log.push(`${at()} เปิด socket แล้ว`);

      let reader = socket.readable.getReader();
      let writer = socket.writable.getWriter();
      const dec = new TextDecoder();
      const enc = new TextEncoder();

      const read = async () => {
        const { value, done } = await reader.read();
        const text = done ? "(ปิดแล้ว)" : dec.decode(value).trim();
        log.push(`${at()} < ${text.slice(0, 120)}`);
        return text;
      };
      const write = async (line: string) => {
        log.push(`${at()} > ${line}`);
        await writer.write(enc.encode(line + "\r\n"));
      };

      await read(); // 220 greeting
      await write("EHLO precare.workers.dev");
      const ehlo = await read();
      log.push(`${at()} เซิร์ฟเวอร์ประกาศ STARTTLS: ${ehlo.includes("STARTTLS")}`);

      await write("STARTTLS");
      await read(); // 220 ready to start TLS

      // ต้องปล่อย lock ก่อน ไม่งั้น startTls จะใช้ stream ไม่ได้ (ตามรายงานบั๊ก)
      reader.releaseLock();
      writer.releaseLock();

      const secure = socket.startTls();
      log.push(`${at()} เรียก startTls() แล้ว`);

      reader = secure.readable.getReader();
      writer = secure.writable.getWriter();
      await write("EHLO precare.workers.dev");
      const after = await read();
      log.push(`${at()} EHLO หลัง TLS สำเร็จ: ${after.startsWith("250")}`);

      await write("QUIT");
      await secure.close();
      return Response.json({ ok: true, log });
    } catch (e) {
      log.push(`${at()} ✘ ${e instanceof Error ? `${e.name}: ${e.message}` : String(e)}`);
      return Response.json({ ok: false, log });
    }
  },
};

export default probe;
