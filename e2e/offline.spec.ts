import { test, expect } from "@playwright/test"
import { createFakeResearch } from "../src/lib/createFakeResearch"
import { location } from "../src/data/location"

// These requests and stories are deterministic mocks; the page and service worker use the production build.
test.use({ viewport: { width: 430, height: 932 } })

test("reopens a cached production app offline, retains its pending question, and resumes its saved conversation", async ({
  page,
  context,
}) => {
  const original = await createFakeResearch({ delayMs: 0 }).discover(location)
  const discovery = {
    ...original,
    stories: original.stories.map(story => ({
      ...story,
      placeId: story.id,
      timeSensitive: false,
      suggestedQuestions: story.suggestedQuestions?.slice(0, 3) ?? [],
      sources: story.sources.map(source => ({
        ...source,
        url:
          new URL(source.url).pathname === "/"
            ? `${source.url}works/the-tay-bridge-disaster`
            : source.url,
      })),
    })),
    researchedAt: original.researchedAt.toISOString(),
    coordinatesExpireAt: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    promptVersion: "ledger-1",
  }
  await page.addInitScript(({ coordinates, accuracyMeters }) => {
    Object.defineProperty(navigator, "geolocation", {
      value: {
        getCurrentPosition: (success: (position: unknown) => void) =>
          success({
            coords: {
              latitude: coordinates.lat,
              longitude: coordinates.lon,
              accuracy: accuracyMeters,
            },
          }),
      },
    })
  }, location)
  let discoveries = 0
  await page.route("**/api/discover", async route => {
    discoveries += 1
    await route.fulfill({ json: { status: "completed", discovery } })
  })
  await page.route("**/api/map", route =>
    route.fulfill({ status: 503, json: { error: { code: "unavailable" } } }),
  )
  const requests: { requestId: string }[] = []
  await page.route("**/api/chat", async route => {
    requests.push(route.request().postDataJSON())
    if (requests.length === 1) return route.abort("failed")
    await route.fulfill({
      json: {
        status: "completed",
        answer: {
          text: "A saved, sourced answer.",
          sources: [{ name: "Local archive", org: "Archive", url: "https://example.com/archive" }],
        },
      },
    })
  })
  await page.goto("/")
  await expect(page.getByRole("button", { name: /worst poet/ })).toBeVisible()
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready
    if (!navigator.serviceWorker.controller)
      await new Promise<void>(resolve =>
        navigator.serviceWorker.addEventListener("controllerchange", () => resolve(), {
          once: true,
        }),
      )
  })
  await page.screenshot({ path: "test-results/ledger-mobile-mocked.png", fullPage: true })
  await page.getByRole("button", { name: /worst poet/ }).click()
  await page.getByPlaceholder("ask a follow-up").fill("What happened next?")
  await page.keyboard.press("Enter")
  await expect(page.getByRole("alert")).toContainText("connection was interrupted")
  const chatUrl = page.url()
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText(/You're offline/)).toBeVisible()
  await expect(page).toHaveURL(chatUrl)
  await expect(page.getByText("What happened next?", { exact: true })).toBeVisible()
  await page.getByRole("button", { name: /story/ }).click()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()
  await page.reload()
  await expect(page.getByText(/Dundee handloom weaver/)).toBeVisible()
  await expect(page.getByPlaceholder("ask a follow-up")).toBeDisabled()
  await page.screenshot({ path: "test-results/ledger-offline-story.png", fullPage: true })
  await page.getByRole("button", { name: "Open conversation" }).click()
  await expect(page.getByText("What happened next?", { exact: true })).toHaveCount(1)
  await expect(page.getByRole("button", { name: "Retry answer", exact: true })).toBeDisabled()
  await context.setOffline(false)
  await page.getByRole("button", { name: "Retry answer", exact: true }).click()
  await expect(page.getByText("A saved, sourced answer.")).toBeVisible()
  expect(requests[1].requestId).toBe(requests[0].requestId)
  expect(discoveries).toBe(1)
})
