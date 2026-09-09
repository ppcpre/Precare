import { describe, expect, it } from "vitest";
import { formatClip, videoMimeOf } from "@/lib/video";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MS, VIDEO_PART_BYTES, maxBytesFor, formatBytes } from "@/lib/storage";

describe("formatClip", () => {
  it("ต่ำกว่านาทีขึ้น 0:ss", () => {
    expect(formatClip(12_000)).toBe("0:12");
    expect(formatClip(9_000)).toBe("0:09");
  });

  it("ปัดเป็นวินาทีที่ใกล้ที่สุด ไม่ใช่ปัดลง", () => {
    // 11.6 วินาทีขึ้น 0:12 — ปัดลงจะได้ 0:11 ซึ่งขัดกับที่เครื่องเล่นแสดง
    expect(formatClip(11_600)).toBe("0:12");
  });

  it("เกินหนึ่งนาทีขึ้น m:ss", () => {
    expect(formatClip(65_000)).toBe("1:05");
  });
});

describe("เพดานไฟล์", () => {
  it("วิดีโอมีเพดานของตัวเอง สูงกว่ารูป", () => {
    expect(maxBytesFor("video")).toBe(MAX_VIDEO_BYTES);
    expect(maxBytesFor("photo")).toBeLessThan(maxBytesFor("video"));
    expect(maxBytesFor("avatar")).toBe(maxBytesFor("photo"));
  });

  /**
   * ตัวเลขสองตัวนี้ผูกกันอยู่ — เทสต์นี้มีไว้ให้ **แดงเมื่อมีคนขยับเพดาน**
   * จะได้ไม่ขยับโดยไม่รู้ว่าโควตารวมรับได้กี่คลิป
   *
   * ⚠️ ที่ 500 MB เหลือแค่ **10 คลิปเต็มเพดานก็เต็มทั้งแอป**
   *    (เดิม 40 MB ได้ 128 คลิป) แปลว่าครอบครัวเดียวกินพื้นที่ของทุกคนได้
   *    โควตารายครอบครัวจึงเปลี่ยนจาก "ควรมี" เป็น "ต้องมีก่อนเปิดให้คนนอกใช้"
   */
  it("โควตารวม 5 GB ที่เพดาน 500 MB เก็บได้ 10 คลิป", () => {
    expect(Math.floor((5 * 1024 ** 3) / MAX_VIDEO_BYTES)).toBe(10);
  });

  /**
   * ขนาดชิ้นต้องอยู่ระหว่างเพดานของ Cloudflare กับขั้นต่ำของ R2
   * ทั้งสองฝั่งเป็นข้อจำกัดของแพลตฟอร์ม แก้ที่โค้ดเราไม่ได้
   */
  it("ขนาดชิ้นอยู่ในกรอบที่แพลตฟอร์มยอม", () => {
    // Cloudflare ตอบ 413 ที่ขอบถ้า body ต่อคำขอเกิน 100 MB (แพลนฟรี/Pro)
    expect(VIDEO_PART_BYTES).toBeLessThanOrEqual(100 * 1024 ** 2);
    // R2 บังคับให้ทุกชิ้นยกเว้นชิ้นสุดท้ายไม่ต่ำกว่า 5 MiB
    expect(VIDEO_PART_BYTES).toBeGreaterThanOrEqual(5 * 1024 ** 2);
    // และจำนวนชิ้นต้องไม่เกิน 10,000 ต่อหนึ่งไฟล์
    expect(Math.ceil(MAX_VIDEO_BYTES / VIDEO_PART_BYTES)).toBeLessThanOrEqual(10_000);
  });

  it("เพดานความยาวอยู่ที่ 30 วินาที", () => {
    expect(MAX_VIDEO_MS).toBe(30_000);
  });

  it("formatBytes อ่านออกในหน่วยที่คนใช้", () => {
    expect(formatBytes(MAX_VIDEO_BYTES)).toBe("500.0 MB");
  });
});

describe("videoMimeOf", () => {
  const file = (name: string, type: string) => new File([new Uint8Array(1)], name, { type });

  it("ใช้ MIME ที่ picker ให้มาถ้าเป็นชนิดที่รับ", () => {
    expect(videoMimeOf(file("a.mp4", "video/mp4"))).toBe("video/mp4");
    expect(videoMimeOf(file("a.mov", "video/quicktime"))).toBe("video/quicktime");
  });

  /**
   * picker บนแอนดรอยด์บางเครื่องส่ง type ว่างมา ถ้าเชื่อ MIME อย่างเดียว
   * คนจะเลือกคลิปของตัวเองแล้วโดนปฏิเสธทั้งที่ไฟล์ไม่ได้มีปัญหา
   */
  it("เดาจากนามสกุลเมื่อ picker ไม่ส่ง MIME มา", () => {
    expect(videoMimeOf(file("IMG_1234.MOV", ""))).toBe("video/quicktime");
    expect(videoMimeOf(file("clip.mp4", ""))).toBe("video/mp4");
  });

  it("ชนิดอื่นคืน null", () => {
    expect(videoMimeOf(file("a.webm", "video/webm"))).toBeNull();
    expect(videoMimeOf(file("a.avi", ""))).toBeNull();
  });
});
