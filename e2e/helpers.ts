import { expect, type Page } from "@playwright/test";
import { deflateSync } from "node:zlib";

/** อีเมลไม่ซ้ำต่อรัน — เทสต์เขียนลง D1 ตัวเดียวกัน ถ้าใช้อีเมลตายตัวจะชนกันเอง */
export const uniqueEmail = (tag: string) =>
  `e2e-${tag}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}@example.test`;

export const PASSWORD = "e2e-Passw0rd!";

/** วันที่ ISO ย้อนหลัง n วันจากวันนี้ */
export function daysAgo(n: number) {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().slice(0, 10);
}

export function daysAhead(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

/**
 * สร้างไฟล์ PNG จริงในหน่วยความจำ ด้วยเนื้อภาพแบบ noise
 *
 * ไม่ commit ไฟล์รูปเข้า repo เพราะต้องคุมขนาดพิกเซลกับจำนวนไบต์ให้ตรงกับที่
 * เทสต์ต้องการ ขนาดต้องเกิน PHOTO_EDGE (1600) ถึงจะได้เดินผ่าน path ย่อรูปจริง
 *
 * ที่ต้องเป็น noise ไม่ใช่ gradient เพราะ gradient บีบอัดได้ดีมาก webp
 * ที่ย่อแล้วเหลือหลักสิบ KB ซึ่งเล็กกว่า bodySizeLimit เดิม (1 MB) เยอะ
 * เทสต์เลยผ่านทั้งที่ลิมิตพัง — พิสูจน์มาแล้วด้วยการใส่บั๊กกลับเข้าไป
 * noise บีบไม่ลง จึงใกล้เคียงรูปถ่ายจากมือถือจริงและกดดัน body limit ได้จริง
 *
 * ใช้ PRNG ที่ seed ได้ ไม่ใช่ Math.random เพื่อให้ขนาดไฟล์ซ้ำเดิมทุกครั้ง
 */
export function makePng(width: number, height: number, seed = 0): Buffer {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  const crc32 = (buf: Buffer) => {
    let c = 0xffffffff;
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
    return (c ^ 0xffffffff) >>> 0;
  };
  const chunk = (type: string, data: Buffer) => {
    const t = Buffer.from(type, "ascii");
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
    return Buffer.concat([len, t, data, crc]);
  };

  // xorshift32 — เร็วพอสำหรับ 7.5 ล้าน byte และให้ผลเดิมทุกครั้งที่ seed เท่ากัน
  let state = (seed + 1) * 2654435761 % 4294967296 || 1;
  const next = () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) & 0xff;
  };

  const raw = Buffer.alloc(height * (width * 3 + 1));
  let p = 0;
  for (let y = 0; y < height; y++) {
    raw[p++] = 0;
    for (let x = 0; x < width; x++) {
      raw[p++] = next();
      raw[p++] = next();
      raw[p++] = next();
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 2;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 1 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}


/**
 * รอจน React ผูก event handler เสร็จ ก่อนจะไปแตะอะไรบนหน้า
 *
 * Playwright ถือว่า navigation จบตอน load event ซึ่งเกิดก่อน hydrate
 * คลิกหรือเลือกไฟล์ในช่วงนั้นจะ "สำเร็จ" ในสายตา Playwright แต่ handler
 * ของ React ยังไม่ติด event เลยหายไปเงียบๆ แล้วเทสต์จะ fail แบบสับสน
 * เหมือนโค้ดพัง ทั้งที่ไม่ได้พัง — เจอมาแล้วทั้งกับ signup และหน้าอัปโหลดรูป
 *
 * ตรวจจาก __reactProps ซึ่งเป็น internal ของ React จริง แต่เป็นสัญญาณเดียว
 * ที่ใช้ได้กับทุกหน้าโดยไม่ต้องไปเติม data attribute ลงโค้ด production
 * ถ้า React เปลี่ยนชื่อ key เทสต์จะ fail ตรงนี้พร้อมข้อความชัดเจน
 */
export async function waitForHydration(page: Page) {
  const problems = watchTransport(page);
  if (await hydrated(page)) return;

  // ถ้าเจอ request ที่ตายกลางทาง แปลว่าเป็นปัญหาขนส่ง ไม่ใช่หน้าพัง
  // (wrangler dev มีบั๊ก ProxyWorker ที่ตัดการเชื่อมต่อเป็นครั้งคราว — docs/tech-notes.md §3.10)
  // โหลดใหม่หนึ่งครั้งเท่านั้น ถ้ายังไม่ขึ้นอีกก็ปล่อยให้ fail
  // จงใจไม่ retry เวลาไม่มี request ตาย เพราะนั่นคือหน้าพังจริง ต้องแดงทันที
  const transportDied = problems.some((p) => p.startsWith("requestfailed"));
  if (transportDied) {
    problems.length = 0;
    await page.reload();
    if (await hydrated(page)) return;
  }

  throw new Error(
    `หน้า ${page.url()} ไม่ hydrate ภายใน ${HYDRATE_TIMEOUT / 1000} วินาที` +
      (transportDied ? " (โหลดใหม่แล้วหนึ่งครั้ง)" : "") +
      "\n" +
      (problems.length
        ? `สิ่งที่พังระหว่างโหลด:\n  ${problems.slice(0, 8).join("\n  ")}`
        : "ไม่มี request ไหนพังและไม่มี error ใน console — " +
          "แปลว่าหน้านี้อาจไม่มี client component เลย หรือ hydrate ช้าผิดปกติ"),
  );
}

const HYDRATE_TIMEOUT = 20_000;

/** true ถ้า React ผูก handler เสร็จภายในเวลาที่กำหนด */
function hydrated(page: Page) {
  return page
    .waitForFunction(
      () => {
        const el = document.querySelector("button, input");
        if (!el) return false;
        const key = Object.keys(el).find((k) => k.startsWith("__reactProps"));
        if (!key) return false;
        const props = (el as unknown as Record<string, Record<string, unknown>>)[key];
        return Boolean(props.onClick ?? props.onChange ?? props.onSubmit);
      },
      undefined,
      { timeout: HYDRATE_TIMEOUT },
    )
    .then(
      () => true,
      () => false,
    );
}

const watched = new WeakMap<Page, string[]>();

/**
 * เก็บ request ที่ตายและ error ใน console ไว้ใช้ตอน hydrate ไม่ผ่าน
 *
 * ข้อความ "ไม่ hydrate ภายใน 20 วินาที" เฉยๆ บอกไม่ได้ว่าโค้ดพัง
 * หรือ dev server ตัดการเชื่อมต่อ — สองอย่างนี้ต้องแก้คนละทาง
 * และบน CI เราย้อนไปดูหน้าจอตอนนั้นไม่ได้ จึงต้องเก็บหลักฐานไว้ตั้งแต่แรก
 */
function watchTransport(page: Page) {
  const existing = watched.get(page);
  if (existing) return existing;

  const problems: string[] = [];
  watched.set(page, problems);
  page.on("requestfailed", (r) => {
    problems.push(`requestfailed ${r.method()} ${r.url()} — ${r.failure()?.errorText}`);
  });
  page.on("response", (r) => {
    if (r.status() >= 400) problems.push(`http ${r.status()} ${r.url()}`);
  });
  page.on("pageerror", (e) => problems.push(`pageerror ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error") problems.push(`console ${m.text().slice(0, 200)}`);
  });
  return problems;
}

/** goto แล้วรอ hydrate — ใช้ตัวนี้แทน page.goto เสมอในเทสต์ */
export async function gotoApp(page: Page, path: string) {
  // ต้องดักก่อน goto — chunk ที่ตายจะตายระหว่างโหลดหน้า ถ้าไปดักทีหลัง
  // จะไม่เห็นอะไรเลยแล้วรายงานผิดว่า "ไม่มี request ไหนพัง"
  // (เขียนดักทีหลังมาแล้วรอบหนึ่ง เทสต์พิสูจน์จับได้)
  watchTransport(page).length = 0;
  await page.goto(path);
  await waitForHydration(page);
}

/** สมัครสมาชิกใหม่ — จบที่ /onboarding เพราะยังไม่มีครอบครัว */
export async function signUp(page: Page, email: string, name = "แม่ทดสอบ") {
  await gotoApp(page, "/signup");
  await page.getByLabel("ชื่อ-นามสกุล").fill(name);
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "สมัครสมาชิก" }).click();
  await page.waitForURL(/\/onboarding/, { timeout: 30_000 });
}

export async function logIn(page: Page, email: string) {
  await gotoApp(page, "/login");
  await page.getByLabel("อีเมล").fill(email);
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "เข้าสู่ระบบ", exact: true }).click();
}

/** ผ่าน onboarding wizard ให้จบ แล้วมีครรภ์อายุ ~24 สัปดาห์ */
export async function completeOnboarding(page: Page, familyName: string) {
  await page.getByRole("button", { name: "เริ่มเลย" }).click();
  await page.getByLabel("ชื่อครอบครัว").fill(familyName);
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByLabel(/วันประจำเดือนครั้งสุดท้าย/).fill(daysAgo(168));
  await page.getByRole("button", { name: "ถัดไป" }).click();
  await page.getByRole("button", { name: "เริ่มใช้ Pre Care" }).click();
  await page.waitForURL(/\/dashboard/, { timeout: 30_000 });
  await expectWeek(page, 24);
}

/**
 * ยึด accessible name ของ progressbar แทนข้อความในการ์ด
 * ข้อความจริงคือ "อายุครรภ์ 24 สัปดาห์ 0 วัน" ซึ่งแตกเป็นหลาย node
 * และเปลี่ยนได้ทุกครั้งที่ปรับ copy — aria-label ผูกกับความหมาย ไม่ใช่การจัดหน้า
 */
export async function expectWeek(page: Page, week: number) {
  await expect(
    page.getByRole("progressbar", { name: new RegExp(`สัปดาห์ที่ ${week}`) }),
  ).toBeVisible();
}

type FilePayload = { name: string; mimeType: string; buffer: Buffer };

/**
 * เลือกไฟล์ผ่านทางที่ผู้ใช้จริงเดิน: กดปุ่ม -> file chooser -> เลือกไฟล์
 *
 * ไม่ใช้ setInputFiles ตรงๆ กับ input ที่ซ่อนอยู่ เพราะแบบนั้นข้ามปุ่มไปเลย
 * ทางนี้ได้ทดสอบว่าปุ่มเปิด file picker ได้จริงไปด้วยในตัว
 */
export async function pickFiles(page: Page, files: FilePayload[]) {
  const [chooser] = await Promise.all([
    page.waitForEvent("filechooser"),
    page.getByRole("button", { name: "เลือกรูป", exact: true }).click(),
  ]);
  await chooser.setFiles(files);
}
