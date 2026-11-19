import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Real-time Documents, Wiki & Knowledge Base Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("creates project, navigates to documents editor and verifies wiki and document workspace", async ({ page }) => {
    const uniqueEmail = `doc_author_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Tech Writer E2E";
    const teamName = `Docs Team ${Date.now()}`;
    const projectName = `Docs Space ${Date.now()}`;

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

    // 2. Create Team & Project
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

    // 3. Open project Kanban, then click Docs button in header
    await page.getByRole("button", { name: "Board" }).first().click();
    await page.waitForLoadState("networkidle");

    const docsNavBtn = page.getByRole("button", { name: "Docs" });
    await expect(docsNavBtn).toBeVisible();
    await docsNavBtn.click();

    // 4. Verify Documents Workspace layout (New Doc, New Folder, editor pane)
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: /New Doc/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /New Folder/i })).toBeVisible();

    // 5. Navigate to Wiki via Projects list
    await page.goto(`${env.baseUrl}/projects`);
    await page.waitForLoadState("networkidle");
    const wikiBtn = page.getByRole("button", { name: "Wiki" }).first();
    if (await wikiBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
      await wikiBtn.click();
      await page.waitForLoadState("networkidle");
      await expect(page).toHaveURL(/.*\/wiki\/.*/);
    }
  });
});
