import { describe, expect, it } from "vitest";
import { formatClip, videoMimeOf } from "@/lib/video";
import { MAX_VIDEO_BYTES, MAX_VIDEO_MS, maxBytesFor, formatBytes } from "@/lib/storage";

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
   * ตัวเลขสองตัวนี้ผูกกันอยู่ ถ้าใครขยับเพดานต่อคลิปโดยไม่คิดถึงโควตารวม
   * จำนวนคลิปที่ทั้งแอปเก็บได้จะร่วงลงทันที เทสต์นี้บังคับให้คิดพร้อมกัน
   */
  it("โควตารวม 5 GB เก็บคลิปเต็มเพดานได้อย่างน้อย 100 คลิป", () => {
    const clips = Math.floor(5 * 1024 ** 3 / MAX_VIDEO_BYTES);
    expect(clips).toBeGreaterThanOrEqual(100);
  });

  it("เพดานความยาวอยู่ที่ 30 วินาที", () => {
    expect(MAX_VIDEO_MS).toBe(30_000);
  });

  it("formatBytes อ่านออกในหน่วยที่คนใช้", () => {
    expect(formatBytes(MAX_VIDEO_BYTES)).toBe("40.0 MB");
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
