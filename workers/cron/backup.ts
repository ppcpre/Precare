/**
 * สำรอง D1 ขึ้น R2 วันละครั้ง
 *
 * GitHub เก็บแค่โค้ด ข้อมูลสุขภาพทั้งหมดอยู่ใน D1 ซึ่งไม่มีสำเนาอยู่ที่ไหนเลย
 * Time Travel ของ D1 ช่วยได้ แต่**แพลนฟรีย้อนได้แค่ 7 วัน** (30 วันคือ Paid)
 * ซึ่งสั้นเกินกว่าจะทันรู้ตัวว่าข้อมูลหายหรือเพี้ยน
 *
 * ใช้ REST API ของ Cloudflare เพราะ binding ของ D1 ไม่มีคำสั่ง dump ทั้งฐาน
 * ขั้นตอนตามที่เอกสารของ Cloudflare วางไว้: สั่ง export → ถามซ้ำจนได้ signed_url
 * → สตรีมลง R2 ตรงๆ **ห้ามอ่านทั้งก้อนเข้าหน่วยความจำ** worker มีเพดาน 128 MB
 *
 * ## ทำไมถึงไม่ค่อยกิน CPU ทั้งที่แพลนฟรีให้แค่ 10 ms
 *
 * เพดาน 10 ms นับเฉพาะเวลาที่ CPU ทำงานจริง การรอ fetch/R2/D1 ไม่นับ
 * งานทั้งหมดในไฟล์นี้คือการรอเน็ตเวิร์ก ไม่มีการแปลงหรือวนข้อมูลก้อนใหญ่เลย
 * — ข้อนี้เป็นเหตุผลที่โค้ดห้ามโตไปทางนั้น
 */
export interface BackupEnv {
  DB: D1Database;
  /** bucket คนละตัวกับ precare-photos — ของสำรองต้องไม่ปนกับของจริง */
  BACKUP_BUCKET?: R2Bucket;
  CF_ACCOUNT_ID?: string;
  CF_DATABASE_ID?: string;
  /** token ที่มีสิทธิ์ D1:Edit — ตั้งด้วย `wrangler secret put` เท่านั้น */
  CF_API_TOKEN?: string;
}

export interface BackupResult {
  status: "ok" | "not_configured" | "failed";
  key?: string;
  bytes?: number;
  /** ไฟล์เก่าที่ลบทิ้งตามอายุในรอบนี้ */
  removed?: number;
  error?: string;
}

/**
 * เก็บย้อนหลังกี่วัน
 *
 * 30 วันเพราะสิ่งที่ Time Travel ทำไม่ได้คือ "รู้ตัวช้า" — ข้อมูลเพี้ยนแบบ
 * ค่อยเป็นค่อยไปกว่าจะมีคนสังเกตเห็นมักเกินสัปดาห์ไปแล้ว
 * ไฟล์ dump ของฐานขนาดนี้อยู่หลักเมกะ 30 ไฟล์จึงไม่กินโควตา R2 อย่างมีนัย
 */
export const KEEP_DAYS = 30;

/** ถามซ้ำได้กี่ครั้งกว่าจะยอมแพ้ — ฐานเล็กมักเสร็จในรอบสองรอบ */
const POLL_TRIES = 20;
const POLL_WAIT_MS = 3_000;

const PREFIX = "d1/";
const keyFor = (day: string) => `${PREFIX}precare-${day}.sql`;
/** คืนวันที่จากชื่อไฟล์ — null เมื่อไม่ใช่ไฟล์ที่รอบนี้เป็นคนตั้งชื่อ */
const dayOf = (key: string) => key.match(/^d1\/precare-(\d{4}-\d{2}-\d{2})\.sql$/)?.[1] ?? null;

export interface BackupDeps {
  fetch?: typeof fetch;
  /** แยกออกมาให้เทสต์ไม่ต้องรอจริง */
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

/**
 * ย้อนหลัง n วันจากวันที่ให้มา เป็น YYYY-MM-DD
 *
 * ตัดเวลาทิ้งก่อนลบวัน ไม่งั้นรอบที่รันคาบเกี่ยวเที่ยงคืนจะได้ขอบคนละวันกัน
 */
export function dayBefore(now: Date, days: number): string {
  const d = new Date(now);
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

export async function runBackup(env: BackupEnv, deps: BackupDeps = {}): Promise<BackupResult> {
  const f = deps.fetch ?? fetch;
  const sleep = deps.sleep ?? ((ms: number) => new Promise((r) => setTimeout(r, ms)));
  const now = (deps.now ?? (() => new Date()))();

  // ขาดอย่างใดอย่างหนึ่งคือยังตั้งค่าไม่ครบ ไม่ใช่พัง — ต้องแยกให้ออกจากกัน
  if (!env.BACKUP_BUCKET || !env.CF_ACCOUNT_ID || !env.CF_DATABASE_ID || !env.CF_API_TOKEN) {
    return record(env, { status: "not_configured" });
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${env.CF_ACCOUNT_ID}/d1/database/${env.CF_DATABASE_ID}/export`;
    const headers = {
      "content-type": "application/json",
      authorization: `Bearer ${env.CF_API_TOKEN}`,
    };

    const started = await f(url, {
      method: "POST",
      headers,
      body: JSON.stringify({ output_format: "polling" }),
    });
    const bookmark = ((await started.json()) as ExportBody)?.result?.at_bookmark;
    if (!bookmark) throw new Error("ไม่ได้ at_bookmark จาก D1 export");

    let signed: string | undefined;
    for (let i = 0; i < POLL_TRIES && !signed; i++) {
      if (i > 0) await sleep(POLL_WAIT_MS);
      const res = await f(url, {
        method: "POST",
        headers,
        body: JSON.stringify({ current_bookmark: bookmark }),
      });
      signed = ((await res.json()) as ExportBody)?.result?.signed_url;
    }
    if (!signed) throw new Error(`dump ยังไม่พร้อมหลังถาม ${POLL_TRIES} ครั้ง`);

    const dump = await f(signed);
    if (!dump.ok || !dump.body) throw new Error(`โหลด dump ไม่ได้ (${dump.status})`);

    const key = keyFor(now.toISOString().slice(0, 10));
    // ส่งเป็นสตรีม ไม่ใช่ arrayBuffer — ฐานโตขึ้นเมื่อไหร่ตัวนี้จะล้มเงียบๆ
    const put = await env.BACKUP_BUCKET.put(key, dump.body);

    const removed = await prune(env.BACKUP_BUCKET, now);
    return record(env, { status: "ok", key, bytes: put?.size ?? undefined, removed });
  } catch (e) {
    // ข้อความอย่างเดียว ห้ามใส่ token หรือข้อมูลผู้ใช้ลงตาราง
    return record(env, { status: "failed", error: e instanceof Error ? e.message : "ไม่ทราบสาเหตุ" });
  }
}

interface ExportBody {
  result?: { at_bookmark?: string; signed_url?: string };
}

/** ลบไฟล์ที่เก่ากว่า KEEP_DAYS — คืนจำนวนที่ลบ */
async function prune(bucket: R2Bucket, now: Date): Promise<number> {
  const cutoff = dayBefore(now, KEEP_DAYS);
  const listed = await bucket.list({ prefix: PREFIX });
  const old = listed.objects
    .map((o) => o.key)
    // ไฟล์ที่ชื่อไม่เข้าแบบไม่ใช่ของเรา ปล่อยไว้ ไม่ใช่หน้าที่รอบนี้จะไปลบ
    .filter((k) => {
      const day = dayOf(k);
      return day !== null && day < cutoff;
    });
  if (old.length > 0) await bucket.delete(old);
  return old.length;
}

async function record(env: BackupEnv, r: BackupResult): Promise<BackupResult> {
  try {
    await env.DB.prepare(
      `INSERT INTO backup_runs (id, status, object_key, bytes, removed, error)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
      .bind(crypto.randomUUID(), r.status, r.key ?? null, r.bytes ?? null, r.removed ?? 0, r.error ?? null)
      .run();
  } catch {
    // จดไม่ลงไม่ควรทำให้ backup ที่สำเร็จแล้วกลายเป็นล้มเหลว
  }
  return r;
}
