/**
 * worker ตัวจับเวลา — เตือนนัดที่ใกล้ถึง และเตือนกินยาตามเวลาที่ตั้งไว้
 *
 * ต้องเป็น worker แยกเพราะ OpenNext คุม entry point ของ worker หลักอยู่
 * เราแทรก handler `scheduled` เข้าไปในนั้นไม่ได้
 *
 * ไม่มี route สาธารณะนอกจาก /healthz — ยิง push เองไม่ได้จากข้างนอก
 */
import { runReminders, type CronEnv } from "./reminders";
import { runMedicationReminders } from "./medications";
import { runBackup, type BackupEnv } from "./backup";

/**
 * ตารางเดินรอบ — ต้องตรงกับ `triggers.crons` ใน wrangler.jsonc ทุกตัวอักษร
 * Cloudflare ส่งสตริงเดิมกลับมาใน event.cron จึงใช้แยกงานได้
 */
const BACKUP_CRON = "20 19 * * *";

export default {
  async scheduled(event: ScheduledController, env: CronEnv & BackupEnv, ctx: ExecutionContext) {
    /**
     * รอบสำรองข้อมูลวันละครั้ง 19:20 UTC = 02:20 ตามเวลาไทย
     *
     * เลือกตีสองกว่าเพราะเอกสารของ D1 บอกว่าระหว่าง export ฐานจะตอบคำขออื่น
     * ไม่ได้ — ชั่วโมงที่คนใช้แอปน้อยที่สุดจึงเป็นเวลาที่เจ็บน้อยที่สุด
     */
    if (event.cron === BACKUP_CRON) {
      ctx.waitUntil(
        runBackup(env).then((r) => {
          // ไม่มีข้อมูลผู้ใช้ในบรรทัดนี้ และผลเต็มๆ อยู่ในตาราง backup_runs
          console.log(`backup status=${r.status} key=${r.key ?? "-"} removed=${r.removed ?? 0}`);
        }),
      );
      return;
    }

    // waitUntil เพื่อให้ Cloudflare รอจนส่งเสร็จจริง ไม่ตัดกลางคัน
    ctx.waitUntil(
      runReminders(env).then((r) => {
        // log ไว้ดูใน observability ว่ารอบนี้ทำอะไรไปบ้าง ไม่มีข้อมูลผู้ใช้ในนี้
        console.log(`reminders due=${r.due} sent=${r.sent} removed=${r.removed}${r.skipped ? ` skipped=${r.skipped}` : ""}`);
      }),
    );

    /**
     * แยก waitUntil จากเตือนนัด — ถ้าตัวหนึ่งพังอีกตัวต้องยังทำงาน
     * (รวมเป็น promise เดียวแล้ว reject ตัวแรกจะกินตัวที่สองไปด้วย)
     */
    ctx.waitUntil(
      runMedicationReminders(env).then((r) => {
        console.log(`medications due=${r.due} sent=${r.sent} removed=${r.removed}${r.skipped ? ` skipped=${r.skipped}` : ""}`);
      }),
    );
  },

  fetch(req: Request) {
    if (new URL(req.url).pathname === "/healthz") return new Response("ok");
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<CronEnv>;
