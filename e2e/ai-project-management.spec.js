import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("AI-01: AI-Powered Project Management Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("verifies AI advisor insights drawer and AI task creator prompt extraction", async ({ page }) => {
    const uniqueEmail = `ai_user_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "AI Lead Engineer";
    const teamName = `AI Team ${Date.now()}`;
    const projectName = `AI Intelligence Project ${Date.now()}`;

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

    // 4. Verify AI Advisor Drawer Trigger
    const aiAdvisorBtn = page.getByRole("button", { name: /AI Advisor/i });
    await expect(aiAdvisorBtn).toBeVisible();
    await aiAdvisorBtn.click();

    const aiDrawer = page.getByRole("dialog", { name: /AI Project Insights Drawer/i });
    await expect(aiDrawer).toBeVisible();
    await expect(aiDrawer.getByText(/Completion Velocity/i)).toBeVisible();

    // Switch to Risks tab in AI Drawer
    await aiDrawer.getByRole("button", { name: /Risks/i }).click();
    await expect(aiDrawer.getByText(/Overall Risk Posture/i)).toBeVisible();

    // Close AI Drawer
    await aiDrawer.getByRole("button", { name: "Close drawer" }).click();
    await expect(aiDrawer).not.toBeVisible();

    // 5. Open AI Prompt Task Creator Modal
    const aiPromptBtn = page.getByRole("button", { name: /AI Prompt/i });
    await expect(aiPromptBtn).toBeVisible();
    await aiPromptBtn.click();

    const aiPromptModal = page.getByRole("dialog", { name: /AI Task Creator/i });
    await expect(aiPromptModal).toBeVisible();

    // Fill natural language task description
    await aiPromptModal.locator("textarea").fill("Fix high priority Redis lock expiration by tomorrow #backend #database");
    await aiPromptModal.getByRole("button", { name: /Extract Fields/i }).click();

    // Verify preview extracted correctly
    await expect(aiPromptModal.getByText(/Extracted Task Preview/i)).toBeVisible();
    await expect(page.locator('#ai-preview-task-title')).toBeVisible();
    await expect(page.locator('#ai-preview-task-title')).toContainText("Fix high priority Redis lock expiration");

    // Click Use Extracted Task to populate standard task modal
    await page.locator('#btn-use-extracted-task').click();

    // Verify task title is loaded in TaskModal
    const taskInput = page.locator('#task-modal-title-input');
    await expect(taskInput).toBeVisible({ timeout: 10000 });
    await expect(taskInput).toHaveValue(/Fix high priority Redis lock expiration/i);
  });
});
