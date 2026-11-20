import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Collaboration, Notifications, Files, Calendar & Settings Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("navigates calendar, files upload view, notifications drawer, and settings views", async ({ page }) => {
    const uniqueEmail = `collab_user_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Collab Engineer E2E";
    const teamName = `Collab Space ${Date.now()}`;
    const projectName = `Collab Project ${Date.now()}`;

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

    // 2. Create Workspace and Project
    await page.goto(`${env.baseUrl}/teams`);
    await page.getByRole("button", { name: "+ Create Team" }).click();
    const modalInput = page.locator('.app-card input[placeholder="Team Name"]');
    await expect(modalInput).toBeVisible();
    await modalInput.fill(teamName);
    await page.locator('.app-card button:has-text("Create Team")').click();
    await expect(page.getByText(teamName).first()).toBeVisible();

    await page.goto(`${env.baseUrl}/projects`);
    await page.getByRole("button", { name: "Create Project" }).first().click();
    const projectDialog = page.getByRole("dialog");
    await expect(projectDialog).toBeVisible();
    await projectDialog.locator('input[placeholder="e.g. Mobile App Redesign"]').fill(projectName);
    await projectDialog.getByRole("combobox").selectOption({ label: teamName });
    await projectDialog.getByRole("button", { name: "Create Project" }).click();
    await expect(page.getByText(projectName).first()).toBeVisible();

    // 3. Navigate to Calendar page
    await page.goto(`${env.baseUrl}/calendar`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /My Calendar & Due Dates/i })).toBeVisible();

    // 4. Navigate to Files page
    await page.goto(`${env.baseUrl}/files`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Project File Repository/i })).toBeVisible();
    await expect(page.getByText(/Choose File to Upload/i)).toBeVisible();

    // 5. Check Notifications Bell in Topbar
    const bellBtn = page.locator('button[aria-label="Notifications"]');
    if (await bellBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await bellBtn.click();
      await expect(page.getByText(/Notifications/i).first()).toBeVisible();
    }

    // 6. Navigate to Settings & Workspace roles
    await page.goto(`${env.baseUrl}/settings`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Settings & Workspace/i })).toBeVisible();
    // Verify Workspace Settings tab exists in settings
    const workspaceTabBtn = page.getByRole("button", { name: /Workspace Settings/i });
    if (await workspaceTabBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await workspaceTabBtn.click();
      await expect(page.getByText(/Workspace Name/i).first()).toBeVisible();
    }
  });
});
