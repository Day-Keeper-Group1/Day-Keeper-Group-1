// KAN-98: the end-to-end tests, which drive a real browser against a running copy of the app.

import { defineConfig, devices } from "@playwright/test";

/**
 * Where the app under test is running. There is no default on purpose: the
 * same test runs against `npm run dev` on this machine and against a deployed
 * preview, and guessing the wrong one would either test nothing or spend the
 * school's key on a site nobody meant to touch. e2e/README.md says which to use.
 */
const baseURL = process.env.E2E_BASE_URL;
if (!baseURL) {
  throw new Error(
    "E2E_BASE_URL is not set. Point it at the app to test, for example " +
      "E2E_BASE_URL=http://localhost:3023 for `npm run dev` in a worktree " +
      "(the port is in .env.local). See e2e/README.md.",
  );
}

export default defineConfig({
  testDir: "e2e",
  // One letter at a time: the test signs in as one account, and two runs at
  // once would only make each other's waiting harder to read.
  workers: 1,
  fullyParallel: false,
  // A retry would hide exactly what this test is for. A reading that only
  // lands on the second attempt is a reading that did not land.
  retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: process.env.CI ? [["github"], ["list"]] : "list",
  // The test sets its own limit from E2E_READ_TIMEOUT_SECONDS, because the
  // waiting for a reading is most of it. This is the ceiling for anything else.
  timeout: 6 * 60 * 1000,
  expect: { timeout: 15_000 },
  use: {
    baseURL,
    // A deployed preview is a cold function on its first request, which can
    // take several seconds before the page answers at all.
    actionTimeout: 30_000,
    navigationTimeout: 60_000,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // A phone, because that is how a letter arrives: someone photographs it.
  // Pixel 7 is Playwright's Android profile, which runs on Chromium.
  projects: [{ name: "chromium", use: { ...devices["Pixel 7"] } }],
});
