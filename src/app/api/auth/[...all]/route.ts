import { getAuth } from "@/lib/auth";

/**
 * REST endpoint เดียวที่ Better Auth เป็นเจ้าของ
 * ส่วนอื่นของแอปใช้ RSC (อ่าน) + Server Actions (เขียน) ไม่มี REST
 */
async function handler(req: Request) {
  const auth = await getAuth();
  return auth.handler(req);
}

export { handler as GET, handler as POST };
