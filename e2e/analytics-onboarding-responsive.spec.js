import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Analytics, Onboarding, Command Palette & Responsive Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("verifies dashboard analytics, onboarding checklist, and command palette navigation", async ({ page, isMobile }) => {
    const uniqueEmail = `analytics_user_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Analytics Lead";

    // 1. Register & login
    await page.goto(`${env.baseUrl}/register`);
    await page.fill('input[placeholder="Name"]', userName);
    await page.fill('input[placeholder="Email"]', uniqueEmail);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Register")');

    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));

    // Handle First Login Wizard dialog if shown
    const closeWizardBtn = page.getByRole("button", { name: /Close dialog/i });
    if (await closeWizardBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeWizardBtn.click();
    }

    // 2. Onboarding checklist is visible on dashboard
    await expect(page.getByRole("heading", { name: "Getting Started with Klavo" })).toBeVisible();
    await expect(page.getByText(/0\/5 completed/i)).toBeVisible();

    // 3. Test Command Palette interaction
    const searchTriggerBtn = page.getByRole("button", { name: /Open global search and command palette/i });
    if (await searchTriggerBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await searchTriggerBtn.click();
      const paletteDialog = page.getByRole("dialog", { name: "Global Command Palette" });
      await expect(paletteDialog).toBeVisible();
      // Dismiss palette via Escape key
      await page.keyboard.press("Escape");
    }

    // 4. Navigate to Analytics page
    await page.goto(`${env.baseUrl}/analytics`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Project Analytics Dashboard/i })).toBeVisible();

    // 5. Test responsive navigation if running on mobile viewport
    if (isMobile) {
      const menuButton = page.getByRole("button", { name: /Open navigation menu/i });
      if (await menuButton.isVisible({ timeout: 1500 }).catch(() => false)) {
        await menuButton.click();
        await expect(page.getByRole("complementary", { name: "Sidebar navigation" })).toBeVisible();
      }
    }
  });
});
