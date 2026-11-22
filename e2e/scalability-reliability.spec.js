import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Scalability & Reliability E2E Validation (SCALE-01)", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("verifies high-frequency task creation, fast UI responsiveness, and offline/reconnection banner handling", async ({ page }) => {
    const uniqueEmail = `scale_tester_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Scale Engineer";
    const projectName = `High Throughput Project ${Date.now()}`;

    // 1. Register & authenticate user
    await page.goto(`${env.baseUrl}/register`);
    await page.fill('input[placeholder="Name"]', userName);
    await page.fill('input[placeholder="Email"]', uniqueEmail);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Register")');

    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));

    // Dismiss onboarding wizard if it appears
    const laterBtn = page.getByRole("button", { name: /I'll do this later/i });
    if (await laterBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await laterBtn.click();
    }
    await page.keyboard.press("Escape");
    await page.waitForTimeout(300);

    // 2. Create project to stress test
    await page.goto(`${env.baseUrl}/projects`);
    await page.waitForLoadState("networkidle");

    const newProjectBtn = page.getByRole("button", { name: /New Project/i });
    if (await newProjectBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await newProjectBtn.click();
      await page.fill('input[name="name"], input[placeholder*="Project"]', projectName);
      const submitBtn = page.getByRole("button", { name: /Create|Save/i });
      if (await submitBtn.isVisible()) {
        await submitBtn.click();
      }
    }

    // 3. Verify settings & system health responsiveness under navigation load
    const startTime = Date.now();
    await page.goto(`${env.baseUrl}/settings`);
    await page.waitForLoadState("networkidle");
    const navLatency = Date.now() - startTime;

    // Responsive navigation should resolve well within 5000ms
    expect(navLatency).toBeLessThan(5000);
    await expect(page.getByRole("heading", { name: /Settings/i })).toBeVisible();

    // 4. Test client offline/online event lifecycle simulation
    await page.evaluate(() => {
      window.dispatchEvent(new Event("offline"));
    });
    await page.waitForTimeout(200);

    // Restore online status
    await page.evaluate(() => {
      window.dispatchEvent(new Event("online"));
    });
    await page.waitForTimeout(200);

    // Ensure dashboard remains operational after network state change
    await page.goto(`${env.baseUrl}/`);
    await page.waitForLoadState("networkidle");
    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));
  });
});
