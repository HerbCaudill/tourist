import { test, expect } from "@playwright/test"

test.use({ viewport: { width: 430, height: 932 } })

test("discovers nearby stories, opens one, and asks a follow-up", async ({ page }) => {
  await page.goto("/?research=fixture")
  await expect(page.getByText(/candlemaker row/)).toBeVisible()
  const row = page.getByRole("button", { name: /worst poet/ })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.click()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()

  await page.getByPlaceholder("ask a follow-up").fill("Did he know people were laughing at him?")
  await page.keyboard.press("Enter")
  await expect(page.getByText("Did he know people were laughing at him?")).toBeVisible()
  await expect(page.getByText(/Probably he knew/)).toBeVisible({ timeout: 10_000 })
})
