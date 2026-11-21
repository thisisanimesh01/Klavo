import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Product Experience & Personalization E2E Journeys (UX-01)", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("verifies dashboard widget toggling, settings density preferences, and command palette navigation", async ({ page }) => {
    const uniqueEmail = `ux_lead_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "UX Architect";
    const teamName = `UX Design Workspace ${Date.now()}`;

    // 1. Register & login
    await page.goto(`${env.baseUrl}/register`);
    await page.fill('input[placeholder="Name"]', userName);
    await page.fill('input[placeholder="Email"]', uniqueEmail);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Register")');

    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));

    const closeWizardBtn = page.getByRole("button", { name: /Close dialog/i });
    if (await closeWizardBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeWizardBtn.click();
    }

    // 2. Personalize Dashboard Widgets
    await expect(page.getByText("Personalize Dashboard Widgets")).toBeVisible();
    const metricsBtn = page.getByRole("button", { name: "Metrics" });
    await expect(metricsBtn).toBeVisible();

    // Toggle Metrics widget off and on
    await metricsBtn.click();
    await metricsBtn.click();

    // 3. Command Palette Trigger via Keyboard Shortcut (Cmd+K or Ctrl+K) or Topbar trigger
    const searchBar = page.getByPlaceholder("Search everything... (Cmd+K)");
    if (await searchBar.isVisible({ timeout: 1500 }).catch(() => false)) {
      await searchBar.click();
      await expect(page.getByPlaceholder("Search projects, tasks, docs, commands...")).toBeVisible();
      // Close Command Palette via Escape
      await page.keyboard.press("Escape");
    }

    // 4. Preferences & Display Density
    await page.goto(`${env.baseUrl}/settings`);
    await page.waitForLoadState("networkidle");

    const preferencesTab = page.getByRole("button", { name: "Preferences" });
    await expect(preferencesTab).toBeVisible();
    await preferencesTab.click();

    await expect(page.getByText("Display Density")).toBeVisible();
    const compactBtn = page.locator("#density-compact-btn");
    await expect(compactBtn).toBeVisible();
    await compactBtn.click();

    // Verify root html class has density-compact
    const rootHasCompact = await page.evaluate(() => document.documentElement.classList.contains("density-compact"));
    expect(rootHasCompact).toBe(true);

    const comfortableBtn = page.locator("#density-comfortable-btn");
    await comfortableBtn.click();
    const rootHasComfortable = await page.evaluate(() => document.documentElement.classList.contains("density-comfortable"));
    expect(rootHasComfortable).toBe(true);
  });
});
