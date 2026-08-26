"use client";

import { createAuthClient } from "better-auth/react";

/** baseURL ว่างไว้ = ใช้ origin ปัจจุบัน จึงทำงานได้ทั้ง localhost / dev / production */
export const authClient = createAuthClient();
export const { signIn, signUp, signOut, useSession } = authClient;
