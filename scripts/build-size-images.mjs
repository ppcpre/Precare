/**
 * สร้างรูปเทียบขนาดลูกน้อยจาก SVG ใน assets/weekly-size/ เป็น .webp พร้อมอัปขึ้น R2
 *
 * ทำไมเก็บ SVG ไว้ในรีโปแทนที่จะเก็บ .webp: ไฟล์ต้นฉบับแก้ได้และ diff ได้
 * ส่วน .webp เป็นของที่สร้างใหม่เมื่อไหร่ก็ได้ ไม่ต้องอยู่ใน git
 *
 * วิธีใช้
 *   node scripts/build-size-images.mjs                 # สร้างลง .tmp/weekly-size
 *   node scripts/build-size-images.mjs --upload        # แล้วอัปขึ้น R2 ของจริง (ต้องล็อกอิน wrangler)
 *   node scripts/build-size-images.mjs --local         # อัปลง R2 ในเครื่อง สำหรับ `npm run dev`
 *
 * ที่มาของภาพ: ดู docs/third-party-licenses.md
 */
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync, mkdirSync } from "node:fs";

const SRC = "assets/weekly-size";
const OUT = ".tmp/weekly-size";
const BUCKET = "precare-assets";
/** ต้องตรงกับ sizeImageKey() ใน src/data/weekly-content.ts */
const keyOf = (week) => `weekly/size/w${String(week).padStart(2, "0")}.webp`;

mkdirSync(OUT, { recursive: true });
const files = readdirSync(SRC).filter((f) => f.endsWith(".svg")).sort();

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 300, height: 300 } });
await page.setContent("<body style='margin:0'></body>");

for (const f of files) {
  const svg = readFileSync(`${SRC}/${f}`, "utf8");
  /**
   * ให้เบราว์เซอร์เข้ารหัส webp เอง — ไม่ต้องพึ่งเครื่องมือแปลงภาพที่เครื่อง
   * อาจไม่มี (cwebp/sharp) และได้พื้นหลังโปร่งใสจริง ซึ่งจำเป็นเพราะรูปวางบน
   * วงกลมสีพีชในการ์ด
   */
  const dataUrl = await page.evaluate(async (src) => {
    const img = new Image();
    img.src = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(src);
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; });
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    // เว้นขอบในเล็กน้อย ไม่ให้ภาพชนขอบวงกลมในการ์ด
    c.getContext("2d").drawImage(img, 12, 12, 232, 232);
    return c.toDataURL("image/webp", 0.92);
  }, svg);
  writeFileSync(`${OUT}/${f.replace(".svg", ".webp")}`, Buffer.from(dataUrl.split(",")[1], "base64"));
}
await browser.close();
console.log(`สร้าง ${files.length} ไฟล์ที่ ${OUT}`);

const upload = process.argv.includes("--upload");
const local = process.argv.includes("--local");
if (upload || local) {
  for (const f of files) {
    const week = Number(f.slice(1, 3));
    const key = keyOf(week);
    execFileSync(
      "npx",
      ["wrangler", "r2", "object", "put", `${BUCKET}/${key}`,
       "--file", `${OUT}/${f.replace(".svg", ".webp")}`,
       "--content-type", "image/webp", local ? "--local" : "--remote"],
      { stdio: "inherit" },
    );
  }
  console.log(local ? "อัปลง R2 ในเครื่องครบแล้ว" : "อัปขึ้น R2 ครบแล้ว");
}
