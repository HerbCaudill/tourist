import { test, expect } from "@playwright/test"

test("displays hello message", async ({ page }) => {
  await page.goto("/")
  await expect(page.getByRole("heading", { name: /Hello,/ })).toBeVisible()
})
