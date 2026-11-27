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
import { runBabyReminders } from "./baby";
import { runChildMedReminders } from "./child-meds";
import { runBackup, type BackupEnv } from "./backup";

/**
 * รอบสำรองข้อมูล = รอบ 5 นาทีที่ตกช่วง 19:20–19:24 UTC (02:20 เวลาไทย)
 *
 * เดิมแยกเป็น cron ตัวที่สอง ("20 19 * * *") แต่บัญชี Workers Free มี cron trigger
 * ได้แค่ 5 ตัวทั้งบัญชี — สองตัวต่อ worker × production + dev ทำให้ deploy dev ล้ม
 * ตั้งแต่เพิ่มรอบสำรอง (code 10072) จึงรวมเหลือ cron เดียวต่อ worker แล้วแยกงานด้วยเวลาแทน
 *
 * รอบนี้ไม่ทำงานเตือน เหมือนตอนแยก cron — ระหว่าง export D1 ตอบคำขออื่นไม่ได้
 * งานเตือนทุกตัวมีช่วงผ่อนผัน รอบ 02:25 จึงตามส่งให้ ไม่มีอะไรหาย
 */
export const isBackupTick = (scheduledTime: number) => {
  const d = new Date(scheduledTime);
  return d.getUTCHours() === 19 && d.getUTCMinutes() >= 20 && d.getUTCMinutes() < 25;
};

export default {
  async scheduled(event: ScheduledController, env: CronEnv & BackupEnv, ctx: ExecutionContext) {
    /**
     * รอบสำรองข้อมูลวันละครั้ง 19:20 UTC = 02:20 ตามเวลาไทย
     *
     * เลือกตีสองกว่าเพราะเอกสารของ D1 บอกว่าระหว่าง export ฐานจะตอบคำขออื่น
     * ไม่ได้ — ชั่วโมงที่คนใช้แอปน้อยที่สุดจึงเป็นเวลาที่เจ็บน้อยที่สุด
     */
    if (isBackupTick(event.scheduledTime)) {
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

    // ยาประจำของลูก — เตือนทั้งบ้าน (คนที่บันทึกได้)
    ctx.waitUntil(
      runChildMedReminders(env).then((r) => {
        console.log(`child-meds due=${r.due} sent=${r.sent} removed=${r.removed}${r.skipped ? ` skipped=${r.skipped}` : ""}`);
      }),
    );

    // เตือนบันทึกลูก — แยก waitUntil ด้วยเหตุผลเดียวกัน
    ctx.waitUntil(
      runBabyReminders(env).then((r) => {
        console.log(
          `baby due=${r.due} sent=${r.sent} late=${r.skippedLate} removed=${r.removed}${r.skipped ? ` skipped=${r.skipped}` : ""}`,
        );
      }),
    );
  },

  fetch(req: Request) {
    if (new URL(req.url).pathname === "/healthz") return new Response("ok");
    return new Response(null, { status: 404 });
  },
} satisfies ExportedHandler<CronEnv>;
