import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "@/db/schema";
import { resetPasswordMail, sendEmail } from "@/lib/email";

/**
 * ต้องสร้าง instance ใหม่ทุก request — binding ของ Workers ผูกกับ request context
 * ห้าม cache ไว้ที่ module scope
 */
/** อายุของลิงก์รีเซ็ตรหัสผ่าน (นาที) — ใช้ทั้งใน better-auth และในเนื้ออีเมล */
export const RESET_TTL_MINUTES = 60;

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
      // ยังไม่บังคับยืนยันอีเมลตอนสมัคร — คนละเรื่องกับการรีเซ็ตรหัสผ่าน
      // และถ้าบังคับตอนนี้ คนที่สมัครไว้แล้วจะเข้าไม่ได้ทั้งหมด
      requireEmailVerification: false,
      minPasswordLength: 8,

      /** ลิงก์รีเซ็ตอยู่ได้ 1 ชั่วโมง — นานพอให้เปิดอีเมลทัน สั้นพอที่ลิงก์หลุดแล้วหมดอายุเร็ว */
      resetPasswordTokenExpiresIn: RESET_TTL_MINUTES * 60,

      /**
       * รีเซ็ตแล้วถอน session ทุกเครื่อง — better-auth ปิดไว้เป็นค่าเริ่มต้น
       *
       * คนที่กดรีเซ็ตคือคนที่เข้าบัญชีตัวเองไม่ได้ ซึ่งบ่อยครั้งแปลว่ามีคนอื่น
       * เข้าไปแล้ว ถ้าไม่ถอน session เครื่องของคนนั้นยังอยู่ในบัญชีต่อไป
       * การตั้งรหัสใหม่ก็ไม่ได้ไล่ใครออกเลย
       */
      revokeSessionsOnPasswordReset: true,

      /**
       * ส่งลิงก์ตั้งรหัสใหม่
       *
       * ห้ามโยน error ออกไปเมื่อส่งไม่สำเร็จ — ฝั่งหน้าเว็บตอบข้อความเดียวกันเสมอ
       * ไม่ว่าอีเมลนั้นจะมีบัญชีหรือไม่ ถ้าปล่อยให้ error ทะลุไป ความต่างของ
       * คำตอบจะกลายเป็นเครื่องมือไล่เดาว่าใครเป็นสมาชิก
       */
      sendResetPassword: async ({ user, url }) => {
        const mail = resetPasswordMail(url, RESET_TTL_MINUTES);
        const res = await sendEmail(env, { ...mail, to: user.email });
        if (res.status !== "sent") {
          // ไม่ log อีเมลหรือ url — url คือกุญแจเข้าบัญชี
          console.error(
            JSON.stringify({
              tag: "reset-mail",
              ...res,
            }),
          );
        }
      },
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
