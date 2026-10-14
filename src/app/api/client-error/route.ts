/**
 * รับรายงานข้อผิดพลาดจากฝั่งเบราว์เซอร์ แล้ว log ไว้ให้เห็นใน `wrangler tail`
 *
 * มีเพราะบั๊กอัปโหลดรูป 14 ต.ค. 69: คำขอไม่เคยวิ่งถึง worker เลย (log ฝั่งเรา
 * ว่างเปล่า) ความจริงทั้งหมดอยู่ในเครื่องผู้ใช้ซึ่งเป็น PWA บนมือถือ
 * ที่เปิด console ดูไม่ได้ ถ้าไม่มีทางให้ฝั่ง client พูด เราจะเดาอย่างเดียว
 *
 * ส่งเฉพาะรูปร่างของปัญหา ไม่ส่งเนื้อหา: ชนิดไฟล์ ขนาด และข้อความ error
 * ไม่มีชื่อไฟล์ ไม่มีคำบรรยาย ไม่มีตัวรูป — ของพวกนั้นเป็นข้อมูลของผู้ใช้
 */
const MAX_LEN = 300;

export async function POST(req: Request) {
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return Response.json({ ok: false }, { status: 400 });
  }

  const str = (v: unknown) => (typeof v === "string" ? v.slice(0, MAX_LEN) : null);

  console.error(
    JSON.stringify({
      tag: "client-error",
      where: str(body.where),
      error: str(body.error),
      /** ขนาดไฟล์เป็นไบต์และชนิด mime เท่านั้น ไม่มีชื่อไฟล์ */
      files: Array.isArray(body.files) ? body.files.slice(0, 20) : null,
      ua: str(req.headers.get("user-agent")),
    }),
  );

  return Response.json({ ok: true });
}
