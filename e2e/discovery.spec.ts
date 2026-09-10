import { test, expect } from "@playwright/test"
import { createFakeResearch } from "../src/lib/createFakeResearch"
import { location } from "../src/data/location"

test.use({ viewport: { width: 430, height: 932 } })

test("types nearby places while polling and replaces the feed when stories finish", async ({
  page,
}) => {
  await page.clock.install()
  await page.addInitScript(position => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success: (value: unknown) => void) =>
          success({ coords: { latitude: position.lat, longitude: position.lon, accuracy: 20 } }),
      },
    })
  }, location.coordinates)
  let complete = false
  await page.route("**/api/discover", route => {
    const request = route.request().postDataJSON()
    return route.fulfill({
      json: complete
        ? {
            status: "completed",
            discovery: {
              location,
              stories: [],
              radiusMeters: 200,
              researchedAt: new Date().toISOString(),
              coordinatesExpireAt: new Date(Date.now() + 29 * 86_400_000).toISOString(),
              promptVersion: "ledger-4",
            },
          }
        : {
            status: "running",
            ticket: "feed-progress",
            retryAfterMs: 1000,
            radiusMeters: 200,
            ...(!request.ticket
              ? {
                  nearbyPlaces: [
                    { name: "James Hutton memorial garden", distanceMeters: 40 },
                    { name: "Edinburgh Town Wall", distanceMeters: 75 },
                    { name: "Pleasance Courtyard", distanceMeters: 90 },
                  ],
                }
              : {}),
          },
    })
  })
  await page.route("**/api/map", route => route.fulfill({ status: 503 }))
  await page.goto("/?research=live")
  await expect(page.getByRole("status")).toContainText("Researching within 200 m")
  await page.clock.runFor(15_000)
  await expect(page.getByText(/Pleasance Courtyard \(90m\)/)).toBeVisible()
  const message = page.getByText(
    /^(Collecting|Poking|Looking|Following|Dusting|Finding|Exploring).*\.\.\.$/,
  )
  for (let step = 0; step < 20 && !(await message.isVisible()); step++) await page.clock.runFor(500)
  await expect(message).toBeVisible()
  await page.screenshot({ path: "test-results/research-feed-mobile.png", fullPage: true })
  complete = true
  await page.clock.runFor(1500)
  await expect(page.getByText(/Nothing worth telling/)).toBeVisible()
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeEnabled()
})

test("recovers from denied location, follows live research progress, and opens a sourced story", async ({
  page,
}) => {
  const fixture = await createFakeResearch({ delayMs: 0 }).discover(location)
  const discovery = {
    ...fixture,
    stories: fixture.stories.map(story => ({
      ...story,
      placeId: story.id,
      sources: story.sources.map(source => ({
        ...source,
        url:
          new URL(source.url).pathname === "/"
            ? `${source.url}works/the-tay-bridge-disaster`
            : source.url,
      })),
      suggestedQuestions: story.suggestedQuestions?.slice(0, 3) ?? [],
      timeSensitive: false,
    })),
    researchedAt: fixture.researchedAt.toISOString(),
    coordinatesExpireAt: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    promptVersion: "ledger-4",
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
  const chatRequests: Record<string, unknown>[] = []
  await page.route("**/api/chat", async route => {
    const request = route.request().postDataJSON()
    if (request.ticket)
      return route.fulfill({
        json: {
          status: "completed",
          answer: {
            text: "A documented reply about the poet.",
            sources: [
              { name: "Local archive", org: "Archive", url: "https://example.com/archive" },
            ],
          },
        },
      })
    chatRequests.push(request)
    if (chatRequests.length === 1) return route.abort("failed")
    await route.fulfill({
      status: 202,
      json: { status: "running", ticket: "answer-ticket", retryAfterMs: 1000 },
    })
  })
  await page.goto("/?research=live")
  await expect(page.getByRole("alert")).toContainText("Location access was denied")
  await page.getByRole("textbox", { name: "Enter a place" }).fill("Candlemaker Row, Edinburgh")
  await page.getByRole("button", { name: "Search", exact: true }).click()
  await expect(page.getByRole("status")).toContainText("Researching within 500 m")
  await expect(page.getByRole("button", { name: "Refresh", exact: true })).toBeDisabled()
  const row = page.getByRole("button", { name: /worst poet/ })
  await expect(row).toBeVisible()
  expect(submissions).toBe(1)
  await expect(page.getByText(/Map unavailable. The stories are still available/)).toBeVisible()
  await row.click()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()
  await expect(page.getByRole("link", { name: /mcgonagall online/ })).toHaveAttribute(
    "href",
    "https://www.mcgonagall-online.org.uk/works/the-tay-bridge-disaster",
  )
  await page.getByPlaceholder("ask a follow-up").fill("What happened next?")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("alert")).toContainText("connection was interrupted")
  await page.getByRole("button", { name: "Retry answer", exact: true }).click()
  await expect(page.getByText("A documented reply about the poet.")).toBeVisible()
  await expect(page.getByRole("link", { name: /Local archive/ })).toHaveAttribute(
    "href",
    "https://example.com/archive",
  )
  await expect(page.getByText("What happened next?", { exact: true })).toHaveCount(1)
  expect(chatRequests[1].requestId).toBe(chatRequests[0].requestId)
  expect(chatRequests[1].originLocation).toEqual(location)
  expect(chatRequests[1].selectedStoryId).toBe("mcgonagall")
})
