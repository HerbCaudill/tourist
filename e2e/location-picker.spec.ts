import { test, expect } from "@playwright/test"

test.use({ viewport: { width: 430, height: 932 } })

test("previews a new place, cancels safely, and commits only on Explore here", async ({ page }) => {
  // Exercise the independent text fallback without requiring Google credentials or network.
  await page.route("https://maps.googleapis.com/**", route => route.abort())
  await page.goto("/?research=fixture")
  const chooser = page.getByRole("button", { name: "Choose a location", exact: true })
  await expect(chooser).toContainText("candlemaker row")
  await page.getByRole("button", { name: "Choose on map" }).click()
  await expect(page.getByRole("dialog", { name: "Choose a location" })).toBeVisible()
  await page.getByRole("combobox", { name: "Search for a place" }).fill("Edinburgh Castle")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.getByRole("button", { name: "Explore here" })).toBeEnabled()
  await expect(page.getByText("Edinburgh Castle", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: "Cancel" }).click()
  await expect(chooser).toContainText("candlemaker row")
  await expect(page.getByRole("button", { name: /worst poet/ })).toBeVisible()
  await chooser.click()
  await page.getByRole("combobox").fill("Edinburgh Castle")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await page.getByRole("button", { name: "Explore here" }).click()
  await expect(page.getByRole("dialog")).toHaveCount(0)
  await expect(chooser).toContainText("edinburgh castle")
})
