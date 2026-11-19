import { defineConfig, devices } from "@playwright/test";

/**
 * Klavo Playwright E2E Testing Configuration (REL-02)
 *
 * Configures isolated browsers, test runners, artifacts, video, trace, and screenshots on failure.
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 30 * 1000,
  expect: {
    timeout: 5000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1, // Deterministic sequential execution to prevent database races
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],
  use: {
    actionTimeout: 10 * 1000,
    navigationTimeout: 15 * 1000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    {
      name: "Desktop Chromium",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1280, height: 800 },
      },
    },
    {
      name: "Mobile Chromium",
      use: {
        ...devices["Pixel 5"],
      },
    },
  ],
});
