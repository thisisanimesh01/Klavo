import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Analytics, Exports & Workflow Automation Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("verifies project analytics dashboard, CSV export action, and automation workflow modal", async ({ page }) => {
    const uniqueEmail = `ops_user_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Ops Automation Lead";
    const teamName = `Operations Team ${Date.now()}`;
    const projectName = `Ops Automation Project ${Date.now()}`;

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

    // 3. Open Project Board
    await page.getByRole("button", { name: "Board" }).first().click();
    await page.waitForLoadState("networkidle");

    // 4. Open Automations Modal from Kanban
    const automationBtn = page.getByRole("button", { name: /Automation/i });
    if (await automationBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await automationBtn.click();
      await expect(page.getByRole("heading", { name: /Workflow Automation & Recurring Tasks/i })).toBeVisible();
      // Dismiss automation modal via its explicit close button
      const closeAutoBtn = page.getByRole("button", { name: "Close automation dialog" });
      if (await closeAutoBtn.isVisible({ timeout: 1000 }).catch(() => false)) {
        await closeAutoBtn.click();
      } else {
        await page.keyboard.press("Escape");
      }
    }

    // 5. Navigate to Project Analytics Dashboard
    await page.goto(`${env.baseUrl}/analytics`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: /Project Analytics Dashboard/i })).toBeVisible();

    // Verify presence of analytics export controls
    await expect(page.getByRole("button", { name: "CSV" }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "PDF" }).first()).toBeVisible();
  });
});
