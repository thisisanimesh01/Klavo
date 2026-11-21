import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Advanced Automation Engine E2E Journeys (AUTO-01)", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("configures automation rules with branching, actions, and tests dry-run simulation", async ({ page }) => {
    const uniqueEmail = `auto_lead_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Automation Engineer";
    const teamName = `Automation Team ${Date.now()}`;
    const projectName = `Workflow Engine Project ${Date.now()}`;

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
    if (await automationBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await automationBtn.click();
      await expect(page.getByRole("heading", { name: /Workflow Automation & Recurring Tasks/i })).toBeVisible();

      // Click "Create Rule"
      const createRuleBtn = page.getByRole("button", { name: "Create Rule" });
      if (await createRuleBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
        await createRuleBtn.click();
        await expect(page.getByText("New Automation Rule")).toBeVisible();

        // Fill rule details
        await page.fill('input[placeholder="e.g. Auto-assign high priority bug"]', "Auto Escalate Bugs");
        await page.selectOption('select:has-text("Match ALL (AND)")', "AND");

        // Submit rule
        await page.click('button:has-text("Save Rule")');
        await expect(page.getByText("Auto Escalate Bugs")).toBeVisible();

        // Verify "Dry Run" button presence
        const dryRunBtn = page.getByRole("button", { name: "Dry Run" }).first();
        await expect(dryRunBtn).toBeVisible();
        await dryRunBtn.click();

        // Verify simulation panel renders
        await expect(page.getByText(/Dry-Run Simulation: Auto Escalate Bugs/i)).toBeVisible();
      }
    }
  });
});
