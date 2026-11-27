/** Stub แทน @better-auth/kysely-adapter — ดูเหตุผลใน src/stubs/kysely.ts */
export const createKyselyAdapter = () => {
  throw new Error("kysely adapter ถูก stub ทิ้ง — โปรเจกต์นี้ใช้ drizzleAdapter");
};
export const getKyselyDatabaseType = () => null;
export const kyselyAdapter = createKyselyAdapter;
