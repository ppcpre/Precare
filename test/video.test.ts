import { describe, expect, it } from "vitest";
import { formatClip } from "@/lib/video";
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
