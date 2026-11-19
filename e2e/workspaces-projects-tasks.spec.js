import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Workspaces, Projects & Kanban Task Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("creates workspace, creates project, and navigates project board", async ({ page }) => {
    const uniqueEmail = `pm_user_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Lead PM E2E";
    const teamName = `Alpha Team ${Date.now()}`;
    const projectName = `Klavo Core ${Date.now()}`;

    // 1. Register & login
    await page.goto(`${env.baseUrl}/register`);
    await page.fill('input[placeholder="Name"]', userName);
    await page.fill('input[placeholder="Email"]', uniqueEmail);
    await page.fill('input[placeholder="Password"]', password);
    await page.click('button:has-text("Register")');

    await expect(page).toHaveURL(new RegExp(`${env.baseUrl}/?$`));

    // Handle First Login Wizard if open
    const closeWizardBtn = page.getByRole("button", { name: /Close dialog/i });
    if (await closeWizardBtn.isVisible({ timeout: 1500 }).catch(() => false)) {
      await closeWizardBtn.click();
    }

    // 2. Navigate to Teams (Workspaces) page
    await page.goto(`${env.baseUrl}/teams`);
    await expect(page.getByRole("heading", { name: "Your Teams" })).toBeVisible();

    // Click "+ Create Team" button
    await page.getByRole("button", { name: "+ Create Team" }).click();
    
    // Fill within Team Modal
    const modalInput = page.locator('.app-card input[placeholder="Team Name"]');
    await expect(modalInput).toBeVisible();
    await modalInput.fill(teamName);
    
    // Click submit inside form
    await page.locator('.app-card button:has-text("Create Team")').click();

    // Verify team is listed in the page
    await expect(page.getByText(teamName).first()).toBeVisible();

    // 3. Navigate to Projects page
    await page.goto(`${env.baseUrl}/projects`);
    await expect(page.getByRole("heading", { name: "Your Projects" })).toBeVisible();

    // Open Create Project modal
    await page.getByRole("button", { name: "Create Project" }).first().click();
    
    // Scoped inside Project Modal dialog
    const projectDialog = page.getByRole("dialog");
    await expect(projectDialog).toBeVisible();
    await projectDialog.locator('input[placeholder="e.g. Mobile App Redesign"]').fill(projectName);

    // Select created team from combobox
    await projectDialog.getByRole("combobox").selectOption({ label: teamName });

    // Submit project creation
    await projectDialog.getByRole("button", { name: "Create Project" }).click();

    // Verify project appears in the projects list
    await expect(page.getByText(projectName).first()).toBeVisible();

    // 4. Click Board action on project card to open Kanban board
    await page.getByRole("button", { name: "Board" }).first().click();

    // Wait for Kanban board to load
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("heading", { name: "Todo" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "In Progress" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Done" })).toBeVisible();

    // 5. Verify board view switcher (Kanban Board, Product Backlog, Milestones & Gantt)
    await expect(page.getByRole("button", { name: "Product Backlog" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Milestones & Gantt" })).toBeVisible();
  });
});
