/**
 * readToken เป็นโค้ดที่เกี่ยวกับความปลอดภัยโดยตรง — ถ้าอ่าน token ผิด
 * อาจกลายเป็นยอมรับ session ที่ไม่ควรยอมรับ จึงต้องมีเทสต์คุม
 */
import { describe, expect, it } from "vitest";
import { readToken } from "@/lib/session";

const TOKEN = "6HFENLDyYfLJ8GT8XobAhTBrfCE8CFAS";
const SIG = "w8Rwv%2BXtZUZGVPlN3KmYE8xAecU9FNtLvAIxmTW%2Bpvc%3D";

describe("readToken", () => {
  it("อ่าน token จาก cookie แบบ https (__Secure-)", () => {
    expect(readToken(`__Secure-better-auth.session_token=${TOKEN}.${SIG}`)).toBe(TOKEN);
  });

  it("อ่าน token จาก cookie แบบ http (localhost)", () => {
    expect(readToken(`better-auth.session_token=${TOKEN}.${SIG}`)).toBe(TOKEN);
  });

  it("หาเจอแม้มี cookie อื่นปนอยู่", () => {
    const header = `theme=dark; __Secure-better-auth.session_token=${TOKEN}.${SIG}; lang=th`;
    expect(readToken(header)).toBe(TOKEN);
  });

  it("ตัดส่วน signature ออก เหลือเฉพาะ token", () => {
    expect(readToken(`better-auth.session_token=${TOKEN}.${SIG}`)).not.toContain(".");
  });

  it("cookie ที่ไม่ใช่ของเราไม่ถูกอ่าน", () => {
    expect(readToken("session_token=ปลอม; other=x")).toBeNull();
    expect(readToken("evil-better-auth.session_token=ปลอม")).toBeNull();
  });

  it("ไม่มี cookie เลย -> null", () => {
    expect(readToken(null)).toBeNull();
    expect(readToken("")).toBeNull();
  });

  it("cookie ว่างเปล่า -> null ไม่ใช่ string ว่าง", () => {
    expect(readToken("better-auth.session_token=")).toBeNull();
    expect(readToken("better-auth.session_token=.sig")).toBeNull();
  });
});
