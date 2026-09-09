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

test("keeps follow-ups below the story on the same URL", async ({ page }) => {
  await page.goto("/?research=fixture")
  await page.getByRole("button", { name: /worst poet/ }).click()
  const storyUrl = page.url()
  await page.getByPlaceholder("ask a follow-up").fill("Who was he?")
  await page.keyboard.press("Enter")
  await expect(page.getByText("Who was he?", { exact: true })).toBeVisible()
  await expect(page).toHaveURL(storyUrl)
  await expect(
    page.getByRole("heading", { name: "The worst poet in the world is buried here" }),
  ).toBeVisible()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeAttached()
  await page.goBack()
  await expect(page.getByRole("button", { name: /worst poet/ })).toBeVisible()
  await page.goForward()
  await expect(page).toHaveURL(storyUrl)
  await expect(page.getByText("Who was he?", { exact: true })).toBeVisible()
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

test("reserves the walking map and scrolls reading between the map and input", async ({ page }) => {
  let release!: () => void
  const ready = new Promise<void>(resolve => {
    release = resolve
  })
  await page.route("**/api/walk", async route => {
    await ready
    await route.fulfill({
      contentType: "image/svg+xml",
      headers: { "X-Walk-Meters": "320", "X-Walk-Seconds": "360" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 300"><rect width="640" height="300" fill="#ddd"/></svg>',
    })
  })
  await page.goto("/?research=fixture")
  await page.getByRole("button", { name: /worst poet/ }).click()
  await expect(page.getByText("Finding a walking route…")).toBeVisible()
  const reading = page.getByRole("article", { name: "Story and conversation" })
  const before = await reading.boundingBox()
  release()
  const map = page.getByRole("img", { name: /Walking route/ })
  await expect(map).toBeVisible()
  const after = await reading.boundingBox()
  expect(after!.y).toBeCloseTo(before!.y, 0)
  expect(after!.height).toBeCloseTo(before!.height, 0)
  const mapBefore = await map.boundingBox()
  const input = page.getByPlaceholder("ask a follow-up")
  const inputBefore = await input.boundingBox()
  await input.fill("Did he know people were laughing at him?")
  await page.keyboard.press("Enter")
  await expect(page.getByText(/Probably he knew/)).toBeVisible()
  await expect.poll(() => reading.evaluate(element => element.scrollTop)).toBeGreaterThan(0)
  expect((await map.boundingBox())!.y).toBeCloseTo(mapBefore!.y, 0)
  expect((await input.boundingBox())!.y).toBeCloseTo(inputBefore!.y, 0)
  await page.screenshot({ path: "test-results/inline-story-chat.png", fullPage: true })
})
