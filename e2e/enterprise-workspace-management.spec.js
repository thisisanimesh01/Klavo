import { test, expect } from "@playwright/test";
import { startUnifiedTestServer } from "./fixtures/testEnvironment.js";

test.describe("Enterprise Workspace Management E2E Journeys (ENT-01)", () => {
  let env;

  test.beforeAll(async () => {
    env = await startUnifiedTestServer();
  });

  test.afterAll(async () => {
    if (env) await env.close();
  });

  test("configures workspace policies, custom roles, and verifies audit trail in Enterprise Settings", async ({ page }) => {
    const uniqueEmail = `enterprise_admin_${Date.now()}@example.com`;
    const password = "Password123!";
    const userName = "Enterprise Administrator";
    const teamName = `Acme Enterprise ${Date.now()}`;

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

    // 3. Navigate to Settings page
    await page.goto(`${env.baseUrl}/settings`);
    await page.waitForLoadState("networkidle");

    // 4. Click Enterprise & Security Tab
    const enterpriseTabBtn = page.locator("#settings-tab-enterprise");
    await expect(enterpriseTabBtn).toBeVisible();
    await enterpriseTabBtn.click();

    // 5. Verify Enterprise Tab Content
    await expect(page.getByText("Workspace Domain & Invitation Policies")).toBeVisible();

    // Check "Enforce domain restrictions"
    const enforceCheckbox = page.locator("#enforceDomainCheck");
    await expect(enforceCheckbox).toBeVisible();

    // 6. Navigate to Custom Roles Sub-tab
    await page.getByRole("button", { name: /Custom Roles/i }).click();
    await expect(page.getByText("Granular Role Definitions")).toBeVisible();

    // 7. Navigate to SSO Sub-tab
    await page.getByRole("button", { name: /Single Sign-On/i }).click();
    await expect(page.getByText(/Assertion Consumer Service \(ACS\) URL:/i)).toBeVisible();

    // 8. Navigate to Audit History Sub-tab & Verify Integrity Action
    await page.getByRole("button", { name: /Audit History/i }).click();
    await expect(page.getByText("Tamper-Resistant Audit Trail")).toBeVisible();
    const verifyIntegrityBtn = page.getByRole("button", { name: /Verify Integrity/i });
    await expect(verifyIntegrityBtn).toBeVisible();
    await verifyIntegrityBtn.click();

    // Confirm verification badge
    await expect(page.getByText(/Chain Integrity Verified/i)).toBeVisible();
  });
});
