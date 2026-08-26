import { expect, test } from "@playwright/test";
import { completeOnboarding, gotoApp, signUp, uniqueEmail } from "./helpers";

/**
 * T6.5 — security headers
 *
 * เทสต์นี้ไม่ได้แค่ดูว่ามี header ครบ แต่ดูว่า CSP ที่ใส่ไปแล้วแอปยังทำงานได้
 * CSP ที่เข้มเกินจะทำให้ script ของ Next ถูกบล็อกแล้วหน้าไม่ hydrate
 * ซึ่งเป็นวิธีพังที่เงียบที่สุด — หน้าดูปกติทุกอย่างแต่กดอะไรไม่ได้เลย
 */
test("หน้าล็อกอินส่ง security header ครบ", async ({ page }) => {
  const res = await page.goto("/login");
  const h = res!.headers();

  expect(h["x-frame-options"]).toBe("DENY");
  expect(h["x-content-type-options"]).toBe("nosniff");
  expect(h["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(h["strict-transport-security"]).toContain("max-age=");

  const csp = h["content-security-policy"];
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).toContain("object-src 'none'");
  expect(csp).toContain("base-uri 'self'");
  // nonce ต้องสุ่มใหม่ทุก request ไม่ใช่ค่าคงที่ที่เดาได้
  expect(csp).toMatch(/'nonce-[a-f0-9]{32}'/);
  expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
});

test("nonce ต้องไม่ซ้ำกันระหว่าง request", async ({ page }) => {
  const first = (await page.goto("/login"))!.headers()["content-security-policy"];
  const second = (await page.goto("/signup"))!.headers()["content-security-policy"];
  const nonceOf = (csp: string) => csp.match(/'nonce-([a-f0-9]{32})'/)?.[1];

  expect(nonceOf(first)).toBeTruthy();
  expect(nonceOf(first)).not.toBe(nonceOf(second));
});

test("CSP ต้องไม่บล็อก script ของแอปจนใช้งานไม่ได้", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error" && /Content Security Policy|CSP/i.test(m.text())) {
      violations.push(m.text());
    }
  });

  // เดินเส้นทางที่ใช้ทั้ง client component, Server Action และ blob: preview
  await signUp(page, uniqueEmail("csp"), "แม่ซีเอสพี");
  await completeOnboarding(page, "ครอบครัวซีเอสพี");
  await gotoApp(page, "/health/new");
  await page.getByLabel("น้ำหนัก").fill("61.5");
  await page.getByRole("button", { name: "บันทึก", exact: true }).click();
  await page.waitForURL(/\/health$/, { timeout: 30_000 });

  expect(violations, `CSP บล็อกของที่แอปต้องใช้:\n${violations.join("\n")}`).toEqual([]);
});
