import { test, expect } from "@playwright/test"
import { createFakeResearch } from "../src/lib/createFakeResearch"
import { location } from "../src/data/location"

test.use({ viewport: { width: 430, height: 932 } })

test("recovers from denied location, follows live research progress, and opens a sourced story", async ({
  page,
}) => {
  const fixture = await createFakeResearch({ delayMs: 0 }).discover(location)
  const discovery = {
    ...fixture,
    stories: fixture.stories.map(({ faq, ...story }) => ({
      ...story,
      placeId: story.id,
      suggestedQuestions: faq?.map(item => item.question).slice(0, 3) ?? [],
      timeSensitive: false,
    })),
    researchedAt: fixture.researchedAt.toISOString(),
    coordinatesExpireAt: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    promptVersion: "ledger-1",
    radiusMeters: 500,
  }
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (_success: unknown, failure: (error: { code: number }) => void) =>
          failure({ code: 1 }),
      },
    })
  })
  await page.route("**/api/location", route => route.fulfill({ json: location }))
  let submissions = 0
  await page.route("**/api/discover", async route => {
    const request = route.request().postDataJSON()
    if (request.ticket) return route.fulfill({ json: { status: "completed", discovery } })
    submissions += 1
    await route.fulfill({
      status: 202,
      json: {
        status: "running",
        ticket: "mocked-continuation",
        retryAfterMs: 1000,
        radiusMeters: 500,
      },
    })
  })
  await page.route("**/api/map", route =>
    route.fulfill({ status: 503, json: { error: { code: "unavailable" } } }),
  )
  await page.goto("/?research=live")
  await expect(page.getByRole("alert")).toContainText("Location access was denied")
  await page.getByRole("textbox", { name: "Enter a place" }).fill("Candlemaker Row, Edinburgh")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("Researching within 500 m")
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled()
  const row = page.getByRole("button", { name: /worst poet/ })
  await expect(row).toBeVisible()
  expect(submissions).toBe(1)
  await expect(page.getByText(/Expanded search: 500 m/)).toBeVisible()
  await expect(page.getByText(/Map unavailable. The stories are still available/)).toBeVisible()
  await row.click()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()
  await expect(page.getByText(/Distance from candlemaker row/)).toBeVisible()
  await expect(page.getByRole("link", { name: /mcgonagall online/ })).toHaveAttribute(
    "href",
    "https://www.mcgonagall-online.org.uk/",
  )
})
