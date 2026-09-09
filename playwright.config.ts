import { defineConfig, devices } from "@playwright/test"

const preview = process.env.TOURIST_PREVIEW === "1"

export default defineConfig({
  testDir: "./e2e",
  ...(preview ? { testMatch: "offline.spec.ts" } : { testIgnore: "offline.spec.ts" }),
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL: preview ? "http://localhost:5180" : "http://localhost:5179",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    command: preview ? "pnpm preview --host 127.0.0.1 --port 5180" : "pnpm dev",
    url: preview ? "http://localhost:5180" : "http://localhost:5179",
    reuseExistingServer: !process.env.CI,
  },
})
