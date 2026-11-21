import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("INT-01: Integrations & Developer Ecosystem Journeys", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("creates workspace, navigates to Integrations settings, generates an API key, and creates an outbound webhook", async ({ page }) => {
    const uniqueEmail = `integrator_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Platform Architect";
    const teamName = `Integration Team ${Date.now()}`;

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

    // 2. Create Workspace
    await page.goto(`${env.baseUrl}/teams`);
    await page.getByRole("button", { name: "+ Create Team" }).click();
    const modalInput = page.locator('.app-card input[placeholder="Team Name"]');
    await expect(modalInput).toBeVisible();
    await modalInput.fill(teamName);
    await page.locator('.app-card button:has-text("Create Team")').click();
    await expect(page.getByText(teamName).first()).toBeVisible();

    // 3. Open Settings -> Integrations & API tab
    await page.goto(`${env.baseUrl}/settings`);
    const integrationsTabBtn = page.locator('#settings-tab-integrations');
    await expect(integrationsTabBtn).toBeVisible();
    await integrationsTabBtn.click();

    await expect(page.getByText(/Workspace API Keys/i)).toBeVisible();

    // 4. Generate API Key
    const generateKeyBtn = page.locator('#btn-create-api-key');
    await expect(generateKeyBtn).toBeVisible();
    await generateKeyBtn.click();

    const apiKeyDialog = page.getByRole("dialog");
    await expect(apiKeyDialog).toBeVisible();
    await apiKeyDialog.locator('input[placeholder*="CI/CD"]').fill("Production CI Pipeline");
    await apiKeyDialog.getByRole("button", { name: /Generate/i }).click();

    // Verify raw key output is visible
    const rawKeyInput = page.locator('#raw-api-key-output');
    await expect(rawKeyInput).toBeVisible();
    const keyVal = await rawKeyInput.inputValue();
    expect(keyVal).toMatch(/^klavo_live_[a-f0-9]+/);

    // Close API Key dialog
    await apiKeyDialog.getByRole("button", { name: /Done/i }).click();
    await expect(page.getByText("Production CI Pipeline")).toBeVisible();

    // 5. Switch to Outbound Webhooks sub-tab
    await page.getByRole("button", { name: /Outbound Webhooks/i }).click();
    await expect(page.getByText(/Subscribe to real-time events/i)).toBeVisible();

    const addWebhookBtn = page.locator('#btn-add-webhook');
    await expect(addWebhookBtn).toBeVisible();
    await addWebhookBtn.click();

    const webhookDialog = page.getByRole("dialog");
    await expect(webhookDialog).toBeVisible();
    await webhookDialog.locator('input[placeholder*="Analytics"]').fill("Event Gateway Webhook");
    await webhookDialog.locator('input[placeholder*="example.com"]').fill("https://api.example.com/webhooks/klavo");
    await webhookDialog.getByRole("button", { name: /Register/i }).click();

    // Verify secret provided and close
    await expect(page.getByText(/Webhook subscription active/i)).toBeVisible();
    await webhookDialog.getByRole("button", { name: /Done/i }).click();

    await expect(page.getByText("Event Gateway Webhook")).toBeVisible();
  });
});
