import { describe, expect, it } from "vitest";
import { MIN_PASSWORD, checkNewPassword } from "@/lib/password";

const ok = (p: string, c = p, e = "somchai@example.com") => checkNewPassword(p, c, e);

describe("กฎของรหัสผ่านใหม่", () => {
  it("รหัสที่ใช้ได้ผ่าน", () => {
    expect(ok("ChaoPhraya!42")).toEqual({ ok: true });
  });

  it(`สั้นกว่า ${MIN_PASSWORD} ตัวไม่ผ่าน`, () => {
    expect(ok("Abc123!").ok).toBe(false);
  });

  it("รหัสยอดนิยมไม่ผ่าน ไม่ว่าจะพิมพ์ใหญ่เล็ก", () => {
    expect(ok("password123").ok).toBe(false);
    expect(ok("PassWord123").ok).toBe(false);
  });

  /** คนที่รู้อีเมลเราคือคนในครอบครัว และข้อมูลในแอปนี้คือข้อมูลสุขภาพ */
  it("มีชื่อหน้าอีเมลอยู่ในรหัสไม่ผ่าน", () => {
    expect(ok("somchai2569").ok).toBe(false);
    expect(ok("xxSOMCHAIxx").ok).toBe(false);
  });

  it("ชื่อหน้าอีเมลสั้นมากไม่ถูกนำมาห้าม — ไม่งั้นรหัสดีๆ จะถูกปัดทิ้ง", () => {
    expect(checkNewPassword("ChaoPhraya!42", "ChaoPhraya!42", "pp@example.com")).toEqual({
      ok: true,
    });
  });

  it("สองช่องไม่ตรงกันไม่ผ่าน", () => {
    expect(ok("ChaoPhraya!42", "ChaoPhraya!43").ok).toBe(false);
  });
});
