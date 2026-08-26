import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";

/**
 * ต้องสร้าง instance ใหม่ทุก request — binding ของ Workers ผูกกับ request context
 * ห้าม cache ไว้ที่ module scope
 */
export async function getAuth() {
  const { env } = await getCloudflareContext({ async: true });
  const db = drizzle(env.DB, { schema });
  const authTestMax =
    Number((env as { AUTH_RATE_LIMIT_MAX?: string }).AUTH_RATE_LIMIT_MAX) || 0;

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,

    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    emailAndPassword: {
      enabled: true,
      // Phase 1 ยังไม่มี email service จึงยืนยันอีเมลไม่ได้ — เปิดใน Phase 1.5
      requireEmailVerification: false,
      minPasswordLength: 8,
    },

    // เปิด Google เฉพาะเมื่อตั้งค่าครบ — ไม่งั้นแอปพังทั้งใบเพราะ env ตัวเดียวหาย
    // ทำให้ dev/preview ที่ยังไม่ได้ใส่ credential ยังรันและทดสอบอีเมล/รหัสผ่านได้
    socialProviders:
      env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID,
              clientSecret: env.GOOGLE_CLIENT_SECRET,
            },
          }
        : {},

    // decision #3: จำ user ไว้ — ปิดแท็บแล้วเปิดใหม่ยังล็อกอินอยู่
    session: {
      expiresIn: 60 * 60 * 24 * 60, // 60 วัน
      updateAge: 60 * 60 * 24, // ต่ออายุให้เองวันละครั้งที่มีการใช้งาน
    },

    /**
     * สำคัญกับ Phase 1 เป็นพิเศษ เพราะยังไม่มีปุ่มลืมรหัสผ่าน
     * คนที่ลืมรหัสจะกด "เข้าสู่ระบบด้วย Google" แล้วเข้าบัญชีเดิมได้ถ้าอีเมลตรงกัน
     */
    account: {
      accountLinking: { enabled: true, trustedProviders: ["google"] },
    },

    user: {
      additionalFields: {
        activeFamilyId: { type: "string", required: false, input: false },
      },
    },

    /**
     * T2.7 — กันเดารหัสผ่านรัวๆ
     *
     * ระวัง: `max` ข้างล่างนี้ไม่ได้คุม /sign-in กับ /sign-up
     * better-auth มี special rule ในตัวที่ 3 ครั้ง/10 วินาที สำหรับ
     * /sign-in, /sign-up, /change-password, /change-email ซึ่งทับค่านี้เสมอ
     * (ดู node_modules/better-auth/dist/api/rate-limiter/index.mjs
     * ฟังก์ชัน getDefaultSpecialRules) — ค่า 20/60s จึงมีผลกับ endpoint
     * อื่นเท่านั้น ส่วนการกันเดารหัสผ่านได้ special rule คุมอยู่แล้วและ
     * เข้มกว่าที่เราตั้งไว้ด้วยซ้ำ
     *
     * customRules เป็นชั้นเดียวที่ทับ special rule ได้ ใช้ตอนรัน E2E
     * ซึ่งสมัคร/ล็อกอินหลายสิบครั้งในนาทีเดียว ไม่ได้ตั้ง env นี้ =
     * ไม่มี customRules เลย พฤติกรรมบน dev และ production จึงไม่เปลี่ยน
     */
    rateLimit: {
      enabled: true,
      window: 60,
      max: 20,
      ...(authTestMax > 0
        ? {
            customRules: {
              "/sign-up/email": { window: 60, max: authTestMax },
              "/sign-in/email": { window: 60, max: authTestMax },
            },
          }
        : {}),
    },
  });
}

export type Auth = Awaited<ReturnType<typeof getAuth>>;
export type Session = Auth["$Infer"]["Session"];
