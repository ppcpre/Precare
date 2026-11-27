/**
 * T6.2 — Integration test ของชั้น query
 *
 * ยิง SQL จริงลง D1 จริงใน workerd — ไม่ mock
 * ครอบคลุมจุดที่ unit test จับไม่ได้: การ join, การแบ่งอดีต/อนาคต,
 * การ parse JSON ของ symptoms, และการกรอง familyId
 */
import { env } from "cloudflare:test";
import { drizzle } from "drizzle-orm/d1";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import * as schema from "@/db/schema";
import {
  getAppointmentById, getDashboard, getFoodDay, getFoodDayByMember, getLayoutData,
  getLogFormDefaults, getPregnancy, getWeeklyLogById, listAppointments, listMembers,
  listPendingInvites, listRecentFoods, listWeeklyLogs,
} from "@/lib/queries";

const db = drizzle(env.DB, { schema });
const now = new Date();
const FAM = "f_q";
const OTHER = "f_other";
const iso = (offsetDays: number) =>
  new Date(Date.now() + offsetDays * 86400_000).toISOString();

beforeEach(async () => {
  for (const t of ["food_logs", "family_invites", "appointments", "weekly_logs",
                   "pregnancy_profiles", "family_members", "families", "user"]) {
    await env.DB.exec(`DELETE FROM ${t}`);
  }

  await db.insert(schema.user).values([
    { id: "u1", name: "แม่ญาญ่า", email: "a@t.local", emailVerified: false, createdAt: now, updatedAt: now },
    { id: "u2", name: "พี่นก", email: "b@t.local", emailVerified: false, createdAt: now, updatedAt: now },
    { id: "u3", name: "คนนอก", email: "c@t.local", emailVerified: false, createdAt: now, updatedAt: now },
  ]);
  await db.insert(schema.families).values([
    { id: FAM, name: "ครอบครัวทดสอบ", ownerId: "u1" },
    { id: OTHER, name: "บ้านอื่น", ownerId: "u3" },
  ]);
  await db.insert(schema.familyMembers).values([
    { id: "m1", familyId: FAM, userId: "u1", role: "owner", status: "active" },
    { id: "m2", familyId: FAM, userId: "u2", role: "editor", status: "active" },
    { id: "m3", familyId: OTHER, userId: "u3", role: "owner", status: "active" },
  ]);
  await db.insert(schema.pregnancyProfiles).values({
    familyId: FAM, lmpDate: "2026-03-10", dueDate: "2026-12-15",
  });
});

describe("listWeeklyLogs", () => {
  beforeEach(async () => {
    await db.insert(schema.weeklyLogs).values([
      { id: "l1", familyId: FAM, recordedBy: "u1", week: 24, weight: 62.5,
        symptoms: '["คลื่นไส้","ปวดหลัง"]', logDate: "2026-08-12" },
      { id: "l2", familyId: FAM, recordedBy: "u2", week: 23, symptoms: null, logDate: "2026-08-05" },
      { id: "l3", familyId: OTHER, recordedBy: "u3", week: 10, logDate: "2026-08-20" },
    ]);
  });

  it("คืนเฉพาะของ family ที่ขอ ไม่ปนของบ้านอื่น", async () => {
    const rows = await listWeeklyLogs(db, FAM);
    expect(rows.map((r) => r.id)).toEqual(["l1", "l2"]);
  });

  it("เรียงจากใหม่ไปเก่า", async () => {
    const rows = await listWeeklyLogs(db, FAM);
    expect(rows[0].logDate > rows[1].logDate).toBe(true);
  });

  it("แปลง symptoms จาก JSON string เป็น array", async () => {
    const rows = await listWeeklyLogs(db, FAM);
    expect(rows[0].symptoms).toEqual(["คลื่นไส้", "ปวดหลัง"]);
  });

  it("symptoms เป็น null ได้ array ว่าง ไม่ใช่ throw", async () => {
    const rows = await listWeeklyLogs(db, FAM);
    expect(rows[1].symptoms).toEqual([]);
  });

  it("join ชื่อผู้บันทึกมาด้วย", async () => {
    const rows = await listWeeklyLogs(db, FAM);
    expect(rows[0].recorderName).toBe("แม่ญาญ่า");
    expect(rows[1].recorderName).toBe("พี่นก");
  });
});

describe("getWeeklyLogById — กรอง familyId", () => {
  beforeEach(async () => {
    await db.insert(schema.weeklyLogs).values({
      id: "lx", familyId: OTHER, recordedBy: "u3", week: 10, logDate: "2026-08-20",
    });
  });

  it("เดา id ของบ้านอื่นแล้วขอด้วย familyId ตัวเอง = ไม่เจอ", async () => {
    expect(await getWeeklyLogById(db, FAM, "lx")).toBeNull();
  });
});

describe("listAppointments", () => {
  beforeEach(async () => {
    await db.insert(schema.appointments).values([
      { id: "a_past", familyId: FAM, createdBy: "u1", apptDatetime: iso(-5), title: "ผ่านมาแล้ว" },
      { id: "a_soon", familyId: FAM, createdBy: "u1", apptDatetime: iso(2), title: "อีก 2 วัน" },
      { id: "a_far", familyId: FAM, createdBy: "u1", apptDatetime: iso(30), title: "อีกเดือน" },
    ]);
  });

  it("upcoming เอาเฉพาะอนาคต เรียงใกล้ไปไกล", async () => {
    const { items } = await listAppointments(db, FAM, "upcoming");
    expect(items.map((a) => a.id)).toEqual(["a_soon", "a_far"]);
  });

  it("past เอาเฉพาะอดีต", async () => {
    const { items } = await listAppointments(db, FAM, "past");
    expect(items.map((a) => a.id)).toEqual(["a_past"]);
  });

  it("คืน now มาด้วย เพื่อให้ component ไม่ต้องเรียก Date.now()", async () => {
    const { now: n } = await listAppointments(db, FAM);
    expect(typeof n).toBe("number");
  });
});

describe("getDashboard", () => {
  it("รวมข้อมูลครบใน batch เดียว", async () => {
    // อายุครรภ์นับจาก "วันนี้" เสมอ ถ้าใช้ lmpDate ตายตัวจาก fixture
    // เทสต์จะผ่านอยู่ช่วงหนึ่งแล้วแดงเองเมื่อเวลาเดินผ่านไป — และมันแดงมาแล้วจริงๆ
    // (คาด 24 ได้ 25) ตั้งย้อนหลังจากวันนี้แทน ผลลัพธ์จึงคงที่ไม่ว่าจะรันวันไหน
    // เผื่อ 3 วันกลางสัปดาห์ไว้ด้วย จะได้ไม่พลิกสัปดาห์ตอนเที่ยงคืน
    const lmp = new Date(Date.now() - (24 * 7 + 3) * 86400_000).toISOString().slice(0, 10);
    await db.update(schema.pregnancyProfiles).set({ lmpDate: lmp });

    await db.insert(schema.appointments).values({
      id: "a1", familyId: FAM, createdBy: "u1", apptDatetime: iso(3), title: "ตรวจครรภ์",
    });
    await db.insert(schema.weeklyLogs).values([
      { id: "l1", familyId: FAM, recordedBy: "u1", week: 24, logDate: "2026-08-12" },
      { id: "l2", familyId: FAM, recordedBy: "u1", week: 23, logDate: "2026-08-05" },
    ]);

    const d = await getDashboard(db, FAM, "u1");
    expect(d.ga?.weeks).toBe(24);
    expect(d.nextAppointment?.id).toBe("a1");
    expect(d.recentLogs).toHaveLength(2);
    expect(d.memberCount).toBe(2);
    expect(typeof d.now).toBe("number");
  });

  it("ยังไม่ตั้ง LMP -> ga เป็น null ไม่ throw", async () => {
    await db.update(schema.pregnancyProfiles).set({ lmpDate: null, dueDate: null });
    const d = await getDashboard(db, FAM, "u1");
    expect(d.ga).toBeNull();
    expect(d.daysLeft).toBeNull();
  });
});

describe("getLayoutData", () => {
  it("มีนัดใน 24 ชม. -> ขึ้นจุดเตือน", async () => {
    await db.insert(schema.appointments).values({
      id: "a1", familyId: FAM, createdBy: "u1", apptDatetime: iso(0.5),
    });
    expect((await getLayoutData(db, FAM)).hasSoonAppointment).toBe(true);
  });

  it("นัดอีก 3 วัน -> ยังไม่ขึ้นจุดเตือน", async () => {
    await db.insert(schema.appointments).values({
      id: "a1", familyId: FAM, createdBy: "u1", apptDatetime: iso(3),
    });
    expect((await getLayoutData(db, FAM)).hasSoonAppointment).toBe(false);
  });
});

describe("listMembers", () => {
  it("ทำเครื่องหมาย isMe ให้ถูกคน และไม่เอาสมาชิกบ้านอื่น", async () => {
    const rows = await listMembers(db, FAM, "u1");
    expect(rows).toHaveLength(2);
    expect(rows.find((r) => r.userId === "u1")?.isMe).toBe(true);
    expect(rows.find((r) => r.userId === "u2")?.isMe).toBe(false);
  });

  it("สมาชิกที่ถูกนำออกแล้วไม่ขึ้นในรายชื่อ", async () => {
    await db.update(schema.familyMembers).set({ status: "removed" })
      .where(eq(schema.familyMembers.id, "m2"));
    expect(await listMembers(db, FAM, "u1")).toHaveLength(1);
  });
});

describe("listPendingInvites", () => {
  it("เอาเฉพาะที่ยัง pending", async () => {
    await db.insert(schema.familyInvites).values([
      { id: "i1", familyId: FAM, invitedEmail: "x@t.local", invitedRole: "editor",
        invitedBy: "u1", status: "pending", expiresAt: iso(7) },
      { id: "i2", familyId: FAM, invitedEmail: "y@t.local", invitedRole: "viewer",
        invitedBy: "u1", status: "accepted", expiresAt: iso(7) },
    ]);
    const rows = await listPendingInvites(db, FAM);
    expect(rows.map((r) => r.id)).toEqual(["i1"]);
  });
});

describe("getLogFormDefaults", () => {
  it("เสนอสัปดาห์จาก LMP และน้ำหนักครั้งล่าสุด", async () => {
    await db.insert(schema.weeklyLogs).values([
      { id: "l1", familyId: FAM, recordedBy: "u1", week: 24, weight: 62.5, logDate: "2026-08-12" },
      { id: "l2", familyId: FAM, recordedBy: "u1", week: 23, weight: 61.0, logDate: "2026-08-05" },
    ]);
    const d = await getLogFormDefaults(db, FAM);
    expect(d.lastWeight).toBe(62.5);
    expect(typeof d.suggestedWeek).toBe("number");
  });

  it("ยังไม่มีบันทึก -> lastWeight เป็น null", async () => {
    expect((await getLogFormDefaults(db, FAM)).lastWeight).toBeNull();
  });
});

describe("getAppointmentById / getPregnancy", () => {
  it("นัดของบ้านอื่นขอด้วย familyId ตัวเอง = ไม่เจอ", async () => {
    await db.insert(schema.appointments).values({
      id: "ax", familyId: OTHER, createdBy: "u3", apptDatetime: iso(1),
    });
    expect(await getAppointmentById(db, FAM, "ax")).toBeUndefined();
  });

  it("getPregnancy คำนวณ ga และวันที่เหลือให้", async () => {
    const p = await getPregnancy(db, FAM);
    expect(p.profile?.lmpDate).toBe("2026-03-10");
    expect(p.ga?.weeks).toBeGreaterThan(0);
  });
});

/**
 * บันทึกอาหารแยกตามคน — บั๊กเดิมคือกรองแค่ familyId แล้วยอดของทุกคนบวกกัน
 *
 * เทสต์ชุดนี้คือด่านที่กันบั๊กนั้นไม่ให้กลับมา และมันเคยแดงจริงกับโค้ดตอนนั้น
 * (หน้าจอไม่ฟ้องอะไรเลยเวลาผิด เห็นแค่ตัวเลขที่ใหญ่เกินจริง)
 */
describe("food logs แยกตามคน", () => {
  const DAY = "2026-10-05";

  beforeEach(async () => {
    await db.insert(schema.foodLogs).values([
      { id: "fa", familyId: FAM, userId: "u1", createdBy: "u1", eatenOn: DAY,
        slot: "lunch", name: "ข้าวมันไก่", kcal: 590, carbG: 72, sugarG: 6, proteinG: 28 },
      { id: "fb", familyId: FAM, userId: "u2", createdBy: "u2", eatenOn: DAY,
        slot: "lunch", name: "ข้าวขาหมู", kcal: 900, carbG: 105, sugarG: 30, proteinG: 34 },
      { id: "fc", familyId: FAM, userId: "u2", createdBy: "u2", eatenOn: DAY,
        slot: "dinner", name: "ส้มตำ", kcal: 120, carbG: 20, sugarG: 12, proteinG: 4 },
      { id: "fd", familyId: OTHER, userId: "u3", createdBy: "u3", eatenOn: DAY,
        slot: "lunch", name: "ของบ้านอื่น", kcal: 700, carbG: 80, sugarG: 10, proteinG: 20 },
    ]);
  });

  it("ยอดของแต่ละคนไม่ปนกัน", async () => {
    const mine = await getFoodDay(db, FAM, "u1", DAY);
    expect(mine.items).toHaveLength(1);
    expect(mine.totals.kcal).toBe(590);

    const theirs = await getFoodDay(db, FAM, "u2", DAY);
    expect(theirs.items).toHaveLength(2);
    expect(theirs.totals.kcal).toBe(1020);
  });

  it("ของครอบครัวอื่นไม่หลุดเข้ามา แม้จะส่ง userId ของคนนอก", async () => {
    const d = await getFoodDay(db, FAM, "u3", DAY);
    expect(d.items).toHaveLength(0);
    expect(d.totals.kcal).toBe(0);
  });

  it("แถบเลือกคนมีสมาชิกทุกคน ยอดของใครของมัน และตัวเองอยู่หน้าสุด", async () => {
    const people = await getFoodDayByMember(db, FAM, DAY, "u2");
    expect(people).toHaveLength(2);
    expect(people[0]).toMatchObject({ userId: "u2", isMe: true, kcal: 1020, items: 2 });
    expect(people[1]).toMatchObject({ userId: "u1", isMe: false, kcal: 590, items: 1 });
    expect(people.every((p) => p.active)).toBe(true);
  });

  it("สมาชิกที่ยังไม่บันทึกอะไรก็ยังมีชิป ยอดเป็นศูนย์และ items เป็นศูนย์", async () => {
    await env.DB.exec("DELETE FROM food_logs WHERE id = 'fa'");
    const people = await getFoodDayByMember(db, FAM, DAY, "u1");
    expect(people[0]).toMatchObject({ userId: "u1", isMe: true, kcal: 0, items: 0 });
  });

  /**
   * คนที่ถูกนำออกจากครอบครัวแล้ว แถวอาหารยังอยู่ (ผูกกับ family_id ไม่ได้ลบตามคน)
   * ถ้าไม่โชว์ชิป ข้อมูลจะหายไปจากสายตาทั้งที่ยังอยู่ในฐาน
   */
  it("คนที่ถูกนำออกไปแล้วแต่ยังมีบันทึกของวันนั้น ยังมีชิปและทำเครื่องหมายว่าไม่ active", async () => {
    await db
      .update(schema.familyMembers)
      .set({ status: "removed" })
      .where(eq(schema.familyMembers.id, "m2"));

    const people = await getFoodDayByMember(db, FAM, DAY, "u1");
    expect(people).toHaveLength(2);
    expect(people.find((p) => p.userId === "u2")).toMatchObject({ active: false, kcal: 1020 });
  });

  it("ชื่อซ้ำกันถูกทำเครื่องหมาย ambiguous ทั้งคู่ ไม่ใช่แค่คนที่สอง", async () => {
    await db.update(schema.user).set({ name: "ญาญ่า" }).where(eq(schema.user.id, "u1"));
    await db.update(schema.user).set({ name: "ญาญ่า" }).where(eq(schema.user.id, "u2"));
    const people = await getFoodDayByMember(db, FAM, DAY, "u1");
    expect(people.every((p) => p.ambiguous)).toBe(true);
  });

  it("ชิป เคยกิน เป็นเมนูของตัวเอง ไม่ใช่ของคนอื่นในบ้าน", async () => {
    const mine = await listRecentFoods(db, FAM, "u1");
    expect(mine.map((r) => r.name)).toEqual(["ข้าวมันไก่"]);
  });
});
