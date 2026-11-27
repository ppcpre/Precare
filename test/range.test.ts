import { describe, expect, it } from "vitest";
import { parseRange } from "@/lib/range";

/**
 * หัว Range — จุดที่ทำให้ Safari กดเล่นวิดีโอแล้วค้าง
 *
 * ของเดิมรองรับแค่ `bytes=a-b` กับ `bytes=a-` ส่วน suffix range (`bytes=-n`)
 * ตกไปเป็น "ส่งทั้งไฟล์ สถานะ 200" ซึ่ง Safari รอไบต์ที่ขอแล้วไม่ได้ เลยค้าง
 * โดยไม่มี error ให้เห็น ส่วน Chrome ไม่ยิงแบบนี้จึงเล่นได้ ปัญหาเลยโผล่ที่เดียว
 */
const SIZE = 1000;

describe("อ่านหัว Range", () => {
  it("ช่วงตรงกลาง", () => {
    expect(parseRange("bytes=100-199", SIZE)).toEqual({ start: 100, end: 199 });
  });

  it("ตั้งแต่ตำแหน่งนั้นจนจบไฟล์", () => {
    expect(parseRange("bytes=900-", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("ไบต์แรกสองไบต์ — คำขอแรกของ Safari", () => {
    expect(parseRange("bytes=0-1", SIZE)).toEqual({ start: 0, end: 1 });
  });

  /** ตัวที่หายไปและทำให้ Safari ค้าง */
  it("suffix range: ขอ n ไบต์ท้ายไฟล์", () => {
    expect(parseRange("bytes=-256", SIZE)).toEqual({ start: 744, end: 999 });
    expect(parseRange("bytes=-1", SIZE)).toEqual({ start: 999, end: 999 });
  });

  it("ขอท้ายไฟล์เกินขนาดไฟล์ = ได้ทั้งไฟล์ แต่ยังเป็นช่วงที่ตอบได้", () => {
    expect(parseRange("bytes=-99999", SIZE)).toEqual({ start: 0, end: 999 });
  });

  it("ปลายทางเกินขอบไฟล์ถูกหั่นลงมาที่ไบต์สุดท้าย", () => {
    expect(parseRange("bytes=900-99999", SIZE)).toEqual({ start: 900, end: 999 });
  });

  it("รูปแบบที่ไม่รองรับหรือไม่มีหัว = ส่งทั้งไฟล์", () => {
    for (const h of [null, "", "bytes=", "bytes=-", "bytes=abc-def", "bytes=0-99,200-299", "items=0-9"]) {
      expect(parseRange(h, SIZE), `${h}`).toBeNull();
    }
  });

  it("ช่วงที่ตอบไม่ได้ = ส่งทั้งไฟล์ ไม่ใช่ช่วงพิสดาร", () => {
    expect(parseRange("bytes=1000-", SIZE)).toBeNull();
    expect(parseRange("bytes=500-100", SIZE)).toBeNull();
    expect(parseRange("bytes=-0", SIZE)).toBeNull();
    expect(parseRange("bytes=0-10", 0)).toBeNull();
  });
});
