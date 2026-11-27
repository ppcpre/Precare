/**
 * T3.8 — Authorization test (งานบังคับ ห้ามตัดทิ้ง)
 *
 * D1 ไม่มี row-level security เลย ความปลอดภัยทั้งหมดอยู่ที่โค้ดใน src/lib/authz.ts
 * เทสต์ชุดนี้จึงยิงกับ **D1 จริงใน workerd จริง** ไม่ใช่ mock
 * ถ้า mock แล้วให้มันตอบตามที่เราเขียนเอง เทสต์จะผ่านทั้งที่ของจริงพัง
 */
import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { and, eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import { AuthzError, can, getMembership, requireRole } from "@/lib/authz";

const db = drizzle(env.DB, { schema });
const now = new Date();

const U = { owner: "u_owner", editor: "u_editor", viewer: "u_viewer", outsider: "u_outsider" };
const FAM = "f_test";
const OTHER_FAM = "f_other";

async function seed() {
  await env.DB.exec("DELETE FROM weekly_logs");
  await env.DB.exec("DELETE FROM family_members");
  await env.DB.exec("DELETE FROM families");
  await env.DB.exec("DELETE FROM user");

  await db.insert(schema.user).values(
    Object.entries(U).map(([k, id]) => ({
      id, name: k, email: `${k}@test.local`, emailVerified: false,
      createdAt: now, updatedAt: now,
    })),
  );
  await db.insert(schema.families).values([
    { id: FAM, name: "ครอบครัวทดสอบ", ownerId: U.owner },
    { id: OTHER_FAM, name: "ครอบครัวอื่น", ownerId: U.outsider },
  ]);
  await db.insert(schema.familyMembers).values([
    { id: "m1", familyId: FAM, userId: U.owner, role: "owner", status: "active" },
    { id: "m2", familyId: FAM, userId: U.editor, role: "editor", status: "active" },
    { id: "m3", familyId: FAM, userId: U.viewer, role: "viewer", status: "active" },
    { id: "m4", familyId: OTHER_FAM, userId: U.outsider, role: "owner", status: "active" },
  ]);
}

beforeEach(seed);

describe("getMembership", () => {
  it("คืน role ตรงตามที่บันทึกไว้", async () => {
    expect(await getMembership(db, FAM, U.owner)).toBe("owner");
    expect(await getMembership(db, FAM, U.editor)).toBe("editor");
    expect(await getMembership(db, FAM, U.viewer)).toBe("viewer");
  });

  it("คนนอกครอบครัวได้ null", async () => {
    expect(await getMembership(db, FAM, U.outsider)).toBeNull();
  });

  it("สมาชิกที่ถูกนำออกแล้ว (status != active) ถือว่าไม่ใช่สมาชิก", async () => {
    await db.update(schema.familyMembers).set({ status: "removed" })
      .where(eq(schema.familyMembers.id, "m2"));
    expect(await getMembership(db, FAM, U.editor)).toBeNull();
  });
});

describe("requireRole — ลำดับสิทธิ์", () => {
  it("owner ผ่านได้ทุกระดับ", async () => {
    for (const lvl of ["viewer", "editor", "owner"] as const) {
      await expect(requireRole(db, FAM, U.owner, lvl)).resolves.toBe("owner");
    }
  });

  it("editor ผ่าน viewer และ editor แต่ไม่ผ่าน owner", async () => {
    await expect(requireRole(db, FAM, U.editor, "viewer")).resolves.toBe("editor");
    await expect(requireRole(db, FAM, U.editor, "editor")).resolves.toBe("editor");
    await expect(requireRole(db, FAM, U.editor, "owner")).rejects.toThrow(AuthzError);
  });

  it("viewer ผ่านแค่ viewer — เขียนอะไรไม่ได้เลย", async () => {
    await expect(requireRole(db, FAM, U.viewer, "viewer")).resolves.toBe("viewer");
    await expect(requireRole(db, FAM, U.viewer, "editor")).rejects.toThrow(AuthzError);
    await expect(requireRole(db, FAM, U.viewer, "owner")).rejects.toThrow(AuthzError);
  });
});

describe("requireRole — คนนอก", () => {
  it("คนนอกเข้าไม่ได้แม้แต่ระดับอ่าน", async () => {
    await expect(requireRole(db, FAM, U.outsider, "viewer")).rejects.toThrow(AuthzError);
  });

  it("คนนอกได้ 404 ไม่ใช่ 403 — ไม่ควรรู้ว่าครอบครัวนี้มีอยู่จริง", async () => {
    await expect(requireRole(db, FAM, U.outsider, "viewer")).rejects.toMatchObject({
      code: "NOT_A_MEMBER", status: 404,
    });
  });

  it("สมาชิกที่สิทธิ์ไม่พอได้ 403 ไม่ใช่ 404", async () => {
    await expect(requireRole(db, FAM, U.viewer, "editor")).rejects.toMatchObject({
      code: "INSUFFICIENT_ROLE", status: 403,
    });
  });

  it("family ที่ไม่มีอยู่จริงก็ได้ 404 เหมือนกัน", async () => {
    await expect(requireRole(db, "f_ไม่มีจริง", U.owner, "viewer")).rejects.toMatchObject({
      status: 404,
    });
  });
});

describe("can.* — ใช้ซ่อนปุ่มตอน render", () => {
  it("ตรงกับ permission matrix ใน architecture.md", () => {
    expect(can.writeRecords("viewer")).toBe(false);
    expect(can.writeRecords("editor")).toBe(true);
    expect(can.writeRecords("owner")).toBe(true);

    expect(can.editPregnancy("editor")).toBe(false);
    expect(can.editPregnancy("owner")).toBe(true);

    expect(can.manageMembers("editor")).toBe(false);
    expect(can.manageMembers("owner")).toBe(true);

    // owner ออกจากครอบครัวเองไม่ได้ ต้องลบ family แทน
    expect(can.leaveFamily("owner")).toBe(false);
    expect(can.leaveFamily("editor")).toBe(true);
  });

  it("คนนอก (null) ทำอะไรไม่ได้เลย", () => {
    expect(can.read(null)).toBe(false);
    expect(can.writeRecords(null)).toBe(false);
    expect(can.manageMembers(null)).toBe(false);
  });
});

describe("scope ของ query — กันแก้ข้ามครอบครัวด้วยการเดา id", () => {
  beforeEach(async () => {
    await db.insert(schema.weeklyLogs).values({
      id: "log_other", familyId: OTHER_FAM, recordedBy: U.outsider,
      week: 20, logDate: "2026-08-01",
    });
  });

  it("update ที่มีเงื่อนไข familyId ด้วย จะไม่โดนแถวของครอบครัวอื่น", async () => {
    const res = await db.update(schema.weeklyLogs).set({ note: "โดนแฮก" })
      .where(and(eq(schema.weeklyLogs.id, "log_other"), eq(schema.weeklyLogs.familyId, FAM)));
    expect(res.meta.changes).toBe(0);

    const row = await db.select().from(schema.weeklyLogs)
      .where(eq(schema.weeklyLogs.id, "log_other")).get();
    expect(row?.note).toBeNull();
  });

  it("delete ก็เช่นกัน", async () => {
    const res = await db.delete(schema.weeklyLogs)
      .where(and(eq(schema.weeklyLogs.id, "log_other"), eq(schema.weeklyLogs.familyId, FAM)));
    expect(res.meta.changes).toBe(0);
    expect(await db.select().from(schema.weeklyLogs).where(eq(schema.weeklyLogs.id, "log_other")).get())
      .toBeTruthy();
  });
});
