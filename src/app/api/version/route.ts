/**
 * บอกว่าเซิร์ฟเวอร์ตอนนี้เป็นบิลด์ไหน
 *
 * แอปที่ติดไว้หน้าจอโฮมเปิดค้างได้เป็นวันๆ โดยไม่โหลดหน้าใหม่เลย
 * พอ deploy บิลด์ใหม่ ปุ่มที่กดจะยิงไปหา Server Action ที่มีรหัสของบิลด์เก่า
 * ซึ่งเซิร์ฟเวอร์หาไม่เจอ แล้ว Next จะขึ้นว่า "An unexpected response was
 * received from the server." ซึ่งผู้ใช้ตีความไม่ได้เลยว่าต้องทำอะไร
 * (เจอจริงตอนอัปโหลดรูป 14 ต.ค. 69)
 *
 * ตอบสั้นที่สุดเท่าที่จะสั้นได้ เพราะฝั่ง client เรียกทุกครั้งที่กลับมาที่แอป
 */
export const dynamic = "force-dynamic";

export function GET() {
  return Response.json(
    { id: process.env.NEXT_PUBLIC_BUILD_ID ?? "unknown" },
    { headers: { "cache-control": "no-store" } },
  );
}
