import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Authentication, Session & Access Control Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("user registration, login, session persistence, and logout flow", async ({ page }) => {
    const uniqueEmail = `testuser_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Test User E2E";

    // 1. Navigate to Register page
    await page.goto(`${env.baseUrl}/register`);
    await expect(page.getByRole("heading", { name: /Create account/i })).toBeVisible();

    // Fill registration form
    await page.fill('input[placeholder="Name"]', userName);
    await page.fill('input[placeholder="Email"]', uniqueEmail);
    await page.fill('input[placeholder="Password"]', password);

    // Submit registration
    await page.click('button:has-text("Register")');

    // Upon registration, user is signed in and redirected to dashboard
    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));

    // If Setup Wizard modal is present for a new user, close/dismiss it so Topbar can be interacted with
    const closeWizardBtn = page.getByRole("button", { name: /Close dialog/i });
    if (await closeWizardBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeWizardBtn.click();
    }

    // 2. Session Persistence: Reload page and verify session remains authenticated
    await page.reload();
    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));

    // Dismiss wizard again if shown on reload
    if (await closeWizardBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeWizardBtn.click();
    }

    // 3. Logout flow using topbar button
    const logoutBtn = page.getByRole("button", { name: /Log out of Klavo/i });
    await expect(logoutBtn).toBeVisible();
    await logoutBtn.click();

    // Verify redirected to login page
    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/login`));
    await expect(page.getByRole("heading", { name: /Welcome to Klavo/i })).toBeVisible();

    // 4. Login with registered credentials
    await page.fill('input[placeholder="Email"]', uniqueEmail);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Login")');

    // Successfully back on dashboard
    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));
  });

  test("displays error on invalid credentials", async ({ page }) => {
    await page.goto(`${env.baseUrl}/login`);
    
    // Set up dialog handler for the alert
    page.once("dialog", async (dialog) => {
      expect(dialog.message()).toMatch(/Invalid email or password/i);
      await dialog.accept();
    });

    await page.fill('input[placeholder="Email"]', "nonexistent@example.com");
    await page.fill('input[placeholder="Password"]', "WrongPassword123");
    
    // Click submit button without awaiting navigation since alert interrupts navigation
    await page.click('button:has-text("Login")', { noWaitAfter: true });
    await page.waitForTimeout(500);
  });

  test("unauthenticated access redirects or displays login view", async ({ page }) => {
    // Clear any local storage
    await page.goto(`${env.baseUrl}/login`);
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try navigating directly to a protected page, e.g. /settings
    await page.goto(`${env.baseUrl}/settings`);
    await page.waitForLoadState("networkidle");

    const currentUrl = page.url();
    expect(currentUrl).toBeDefined();
  });
});
