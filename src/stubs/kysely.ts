/**
 * Stub แทน kysely — better-auth ประกาศ adapter ทุกตัวเป็น hard dependency
 * แต่โปรเจกต์นี้ใช้ drizzleAdapter อย่างเดียว
 *
 * kysely อย่างเดียว 3.4 MB · เพดาน worker บน Cloudflare free plan มีแค่ 3 MiB (gzip)
 * จึง alias ทิ้งใน next.config.ts
 *
 * ⚠️ ถ้าเปลี่ยนไปใช้ adapter ตัวอื่น (kysely/mongo/prisma) ต้องเอา alias ออกก่อน
 *    ทุก export ที่นี่โยน error ทันทีที่ถูกเรียก จะได้รู้ตัวเร็ว ไม่ใช่พังเงียบๆ
 */
const boom = (name: string) => () => {
  throw new Error(`kysely ถูก stub ทิ้ง (${name}) — โปรเจกต์นี้ใช้ drizzleAdapter ดู src/stubs/kysely.ts`);
};

export const Kysely = boom("Kysely");
export const SqliteDialect = boom("SqliteDialect");
export const MysqlDialect = boom("MysqlDialect");
export const PostgresDialect = boom("PostgresDialect");
export const MssqlDialect = boom("MssqlDialect");
export const SqliteAdapter = boom("SqliteAdapter");
export const SqliteQueryCompiler = boom("SqliteQueryCompiler");
export const DefaultQueryCompiler = boom("DefaultQueryCompiler");
export const CompiledQuery = boom("CompiledQuery");
export const sql = boom("sql");
