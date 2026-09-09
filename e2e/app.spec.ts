import { test, expect } from "@playwright/test"

test.use({ viewport: { width: 430, height: 932 } })

test("discovers nearby stories, opens one, and asks a follow-up", async ({ page }) => {
  await page.goto("/?research=fixture")
  await expect(page.getByRole("textbox", { name: "Enter a place" })).toHaveAttribute(
    "placeholder",
    /candlemaker row/,
  )
  const row = page.getByRole("button", { name: /worst poet/ })
  await expect(row).toBeVisible({ timeout: 10_000 })
  await row.click()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()

  await page.getByPlaceholder("ask a follow-up").fill("Did he know people were laughing at him?")
  await page.keyboard.press("Enter")
  await expect(page.getByText("Did he know people were laughing at him?")).toBeVisible()
  await expect(page.getByText(/Probably he knew/)).toBeVisible({ timeout: 10_000 })
})

test("keeps story and chat navigation in browser history", async ({ page }) => {
  await page.goto("/?research=fixture")
  await page.getByRole("button", { name: /worst poet/ }).click()
  await expect(page).toHaveURL(/\/stories\//)
  const storyUrl = page.url()
  await page.getByPlaceholder("ask a follow-up").fill("Who was he?")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/chats\//)
  const chatUrl = page.url()
  await page.getByPlaceholder("ask a follow-up").fill("What happened next?")
  await page.keyboard.press("Enter")
  await expect(page.getByText("What happened next?", { exact: true })).toBeVisible()
  await page.goBack()
  await expect(page).toHaveURL(storyUrl)
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()
  await page.goBack()
  await expect(page.getByRole("button", { name: /worst poet/ })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(storyUrl)
  await page.goForward()
  await expect(page).toHaveURL(chatUrl)
  await expect(page.getByText("Who was he?", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /story/ }).click()
  await expect(page).toHaveURL(storyUrl)
  await page.goForward()
  await expect(page).toHaveURL(chatUrl)
})

test("restores general chat with forward and handles unavailable direct links", async ({
  page,
}) => {
  await page.goto("/?research=fixture")
  await expect(page.getByRole("button", { name: /worst poet/ })).toBeVisible()
  await page.getByPlaceholder("Ask me anything").fill("Why is it called Candlemaker Row?")
  await page.keyboard.press("Enter")
  await expect(page).toHaveURL(/\/chats\//)
  await expect(page.getByText(/candlemakers’ guild/)).toBeVisible()
  await page.goBack()
  await expect(page.getByPlaceholder("Ask me anything")).toBeVisible()
  await page.goForward()
  await expect(page.getByText(/candlemakers’ guild/)).toBeVisible()
  await page.goto("/stories/missing/story?research=fixture")
  await expect(page.getByText("This page is no longer saved on this device.")).toBeVisible()
  await page.getByRole("button", { name: "Back to nearby" }).click()
  await expect(page).toHaveURL(/\/\?research=fixture$/)
  await expect(page.getByRole("button", { name: /worst poet/ })).toBeVisible()
})
