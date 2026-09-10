// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { createResearchService } from "../createResearchService.ts"
import type { PlacesAdapter } from "../types.ts"

/** Exercise discovery against a persistent runner without network dependencies. */
function setup(results: unknown[]) {
  const jobs = new Map<
    string,
    { id: string; status: "completed"; result: string; context?: string }
  >()
  const nearby = vi.fn(async () => [candidate])
  const describeLocation = vi.fn(async () => "Greyfriars Kirk, Edinburgh")
  const resolveStory = vi.fn<PlacesAdapter["resolveStory"]>(async () => ({
    id: "resolved-site",
    coordinates: location.coordinates,
  }))
  const start = vi.fn(async (id: string, _prompt: string, context?: string) => {
    jobs.set(id, { id, status: "completed", result: JSON.stringify(results.shift()), context })
    return { id, status: "queued" as const, context }
  })
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    now: () => new Date("2026-09-09T13:00:00Z"),
    places: { describeLocation, nearby, resolveStory, resolve: vi.fn(), map: vi.fn() },
    runner: { start, get: async (id: string) => jobs.get(id) ?? null },
  })
  return { service, nearby, resolveStory, describeLocation, start }
}

/** Require a resumable response in a test that has just submitted research. */
function ticketOf(
  result: Awaited<ReturnType<ReturnType<typeof createResearchService>["discover"]>>,
) {
  if (result.status === "completed") throw new Error("Expected pending research")
  return result.ticket
}

const location = {
  name: "Edinburgh",
  area: "",
  coordinates: { lat: 55.946, lon: -3.192 },
  accuracyMeters: 20,
}
const candidate = { id: "place-1", name: "Churchyard", coordinates: location.coordinates }
const story = {
  id: "story-1",
  locationQuery: "Greyfriars Kirkyard, Edinburgh, Scotland",
  place: "A churchyard",
  title: "A memorable story",
  preview: "A supported preview.",
  account: ["A sourced historical account."],
  sources: [{ name: "History", org: "Archive", url: "https://example.org/history" }],
  suggestedQuestions: ["What happened next?"],
  timeSensitive: false,
}
const requestId = "13516742-4173-49c5-ae65-376e147c4dad"

describe("persistent discovery", () => {
  it("describes GPS locations before generating stories and reuses submitted jobs", async () => {
    const { service, start, describeLocation } = setup([{ stories: [story] }])
    const gps = { ...location, name: "55.9460, -3.1920" }
    await service.discover({ requestId, location: gps })
    await service.discover({ requestId, location: gps })
    expect(describeLocation).toHaveBeenCalledExactlyOnceWith(location.coordinates)
    expect(start.mock.calls[0][1]).toContain("Current location: Greyfriars Kirk, Edinburgh")
  })
  it("sends readable location and nearby names to the researcher", async () => {
    const { service, start } = setup([{ stories: [story] }])
    await service.discover({ requestId, location })
    expect(start.mock.calls[0][1]).toContain("Current location: Edinburgh")
    expect(start.mock.calls[0][1]).toContain("Search radius: 200 meters")
    expect(start.mock.calls[0][1]).toContain("Nearby places:\n- Churchyard")
  })
  it("locates a story at an intersection absent from the nearby orientation places", async () => {
    const query = "Candlemaker Row and Cowgate, Edinburgh, Scotland"
    const { service, nearby, resolveStory } = setup([
      { stories: [{ ...story, locationQuery: query }] },
    ])
    nearby.mockResolvedValue([])
    const initial = await service.discover({ requestId, location })
    const done = await service.discover({ ticket: ticketOf(initial) })
    expect(done).toMatchObject({
      status: "completed",
      discovery: { stories: [{ placeId: "resolved-site", coordinates: location.coordinates }] },
    })
    expect(resolveStory).toHaveBeenCalledWith(query)
  })
  it("returns nearby labels and distances on submission and replays without another place lookup", async () => {
    const { service, start } = setup([{ stories: [story] }])
    const initial = await service.discover({ requestId, location })
    expect(initial).toMatchObject({ nearbyPlaces: [{ name: "Churchyard", distanceMeters: 0 }] })
    const replay = await service.discover({ requestId, location })
    expect(replay).not.toHaveProperty("nearbyPlaces")
    expect(start).toHaveBeenCalledOnce()
  })
  it("expands only after an empty validated result, stopping as soon as a story survives", async () => {
    const { service, nearby } = setup([{ stories: [] }, { stories: [story] }])
    const initial = await service.discover({ requestId, location })
    expect(initial).toMatchObject({ status: "queued", radiusMeters: 200 })
    const expanded = await service.discover({ ticket: ticketOf(initial) })
    expect(expanded).toMatchObject({ status: "queued", radiusMeters: 500 })
    const done = await service.discover({ ticket: ticketOf(expanded) })
    expect(done).toMatchObject({
      status: "completed",
      discovery: {
        radiusMeters: 500,
        stories: [{ title: story.title, distanceMeters: 0, coordinates: location.coordinates }],
      },
    })
    expect(nearby.mock.calls).toHaveLength(2)
  })

  it("reports malformed output without silently expanding or accepting unsafe sources", async () => {
    const { service, nearby } = setup([
      { stories: [{ ...story, sources: [{ ...story.sources[0], url: "javascript:alert(1)" }] }] },
    ])
    const initial = await service.discover({ requestId, location })
    await expect(service.discover({ ticket: ticketOf(initial) })).rejects.toMatchObject({
      code: "malformed",
    })
    expect(nearby).toHaveBeenCalledTimes(1)
  })

  it("rejects tampered tickets and a caller-supplied search radius", async () => {
    const { service } = setup([{ stories: [] }])
    const initial = await service.discover({ requestId, location })
    const ticket = ticketOf(initial)
    const tampered = (ticket[0] === "A" ? "B" : "A") + ticket.slice(1)
    await expect(service.discover({ ticket: tampered })).rejects.toMatchObject({
      code: "expired",
    })
    await expect(
      service.discover({ requestId, location, radiusMeters: 1000 }),
    ).rejects.toMatchObject({ code: "invalid" })
  })
})

it.each([null, { id: "distant-site", coordinates: { lat: 56, lon: -3.192 } }])(
  "expands when a story's site is unresolved or outside the radius: %j",
  async site => {
    const { service, resolveStory } = setup([{ stories: [story] }])
    resolveStory.mockResolvedValueOnce(site)
    const initial = await service.discover({ requestId, location })
    const expanded = await service.discover({ ticket: ticketOf(initial) })
    expect(expanded).toMatchObject({ status: "queued", radiusMeters: 500 })
  },
)

it("reports a story geocoding outage instead of treating it as an empty discovery", async () => {
  const { service, resolveStory, nearby } = setup([{ stories: [story] }])
  resolveStory.mockRejectedValueOnce(new Error("Provider unavailable"))
  const initial = await service.discover({ requestId, location })
  await expect(service.discover({ ticket: ticketOf(initial) })).rejects.toThrow(
    "Provider unavailable",
  )
  expect(nearby).toHaveBeenCalledTimes(1)
})

it("safely replays a submitted request after losing its first response", async () => {
  const { service, start } = setup([{ stories: [story] }])
  await service.discover({ requestId, location })
  const replay = await service.discover({ requestId, location })
  const done = await service.discover({ ticket: ticketOf(replay) })
  expect(done).toMatchObject({ status: "completed", discovery: { stories: [{ id: story.id }] } })
  expect(start).toHaveBeenCalledTimes(1)
})

it("returns an empty result after all three radii have no stories", async () => {
  const { service, nearby } = setup([{ stories: [] }, { stories: [] }, { stories: [] }])
  let result = await service.discover({ requestId, location })
  result = await service.discover({ ticket: ticketOf(result) })
  result = await service.discover({ ticket: ticketOf(result) })
  result = await service.discover({ ticket: ticketOf(result) })
  expect(result).toMatchObject({
    status: "completed",
    discovery: { radiusMeters: 1000, stories: [] },
  })
  expect(nearby).toHaveBeenCalledTimes(3)
})

it("reports a lost or expired job instead of restarting research during a poll", async () => {
  const start = vi.fn(async (id: string, _prompt: string, context?: string) => ({
    id,
    status: "queued" as const,
    context,
  }))
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    places: {
      nearby: async () => [candidate],
      resolve: vi.fn(),
      map: vi.fn(),
      describeLocation: vi.fn(async () => "Greyfriars Kirk, Edinburgh"),
      resolveStory: vi.fn(async () => ({ id: "resolved-site", coordinates: location.coordinates })),
    },
    runner: { start, get: async () => null },
  })
  const result = await service.discover({ requestId, location })
  await expect(service.discover({ ticket: ticketOf(result) })).rejects.toMatchObject({
    code: "expired",
  })
  expect(start).toHaveBeenCalledTimes(1)
})

it("expires context after a day and does not reveal precise location in its ticket", async () => {
  let time = new Date("2026-09-09T00:00:00Z")
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    now: () => time,
    places: {
      nearby: async () => [candidate],
      resolve: vi.fn(),
      map: vi.fn(),
      describeLocation: vi.fn(async () => "Greyfriars Kirk, Edinburgh"),
      resolveStory: vi.fn(async () => ({ id: "resolved-site", coordinates: location.coordinates })),
    },
    runner: {
      start: async (id, _prompt, context) => ({ id, status: "queued", context }),
      get: async () => null,
    },
  })
  const initial = await service.discover({ requestId, location })
  expect(Buffer.from(ticketOf(initial), "base64url").toString()).not.toContain("55.946")
  time = new Date("2026-09-10T00:00:01Z")
  await expect(service.discover({ ticket: ticketOf(initial) })).rejects.toMatchObject({
    code: "expired",
  })
})

it("passes bounded selected-story and conversation context into a follow-up, with all answer sources preserved", async () => {
  const { service, start } = setup([{ text: "A sourced follow-up [1].", sources: story.sources }])
  const { locationQuery: _query, ...publicStory } = story
  const input = {
    requestId,
    question: "What happened next?",
    location,
    originLocation: { ...location, name: "Original churchyard" },
    stories: [
      {
        ...publicStory,
        placeId: "resolved-site",
        coordinates: location.coordinates,
        distanceMeters: 0,
        bearing: "N",
      },
    ],
    selectedStoryId: story.id,
    history: [
      { role: "user", text: "Who was here?" },
      { role: "tourist", text: "A historical person." },
    ],
  }
  const initial = await service.chat(input)
  if (initial.status === "completed") throw new Error("Expected pending chat")
  const answer = await service.chat({ ticket: initial.ticket })
  expect(answer).toMatchObject({ status: "completed", answer: { sources: story.sources } })
  expect(start.mock.calls[0]?.[1]).toContain("Who was here?")
  expect(start.mock.calls[0]?.[1]).toContain(`Selected story: ${story.title} (${story.place})`)
  expect(start.mock.calls[0]?.[1]).toContain("Original churchyard")
  await expect(
    service.chat({ ...input, history: Array.from({ length: 13 }, () => input.history[0]) }),
  ).rejects.toMatchObject({ code: "invalid" })
})

it("reconnects with the original geographic context when Google changes or becomes unavailable", async () => {
  const { service, nearby } = setup([{ stories: [story] }])
  await service.discover({ requestId, location })
  nearby.mockRejectedValue(new Error("Google is unavailable"))
  const replay = await service.discover({ requestId, location })
  const result = await service.discover({ ticket: ticketOf(replay) })
  expect(result).toMatchObject({
    status: "completed",
    discovery: { stories: [{ coordinates: candidate.coordinates }] },
  })
  expect(nearby).toHaveBeenCalledTimes(1)
})

it("uses the first persisted context when duplicate creates race with different Google candidates", async () => {
  const jobs = new Map<
    string,
    { id: string; status: "completed"; result: string; context?: string }
  >()
  const nearby = vi
    .fn()
    .mockResolvedValueOnce([candidate])
    .mockResolvedValueOnce([
      {
        ...candidate,
        coordinates: { ...candidate.coordinates, lat: candidate.coordinates.lat + 0.001 },
      },
    ])
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    places: {
      nearby,
      resolve: vi.fn(),
      map: vi.fn(),
      describeLocation: vi.fn(async () => "Greyfriars Kirk, Edinburgh"),
      resolveStory: vi.fn(async () => ({ id: "resolved-site", coordinates: location.coordinates })),
    },
    runner: {
      get: async id => jobs.get(id) ?? null,
      start: async (id, _prompt, context) => {
        if (jobs.has(id)) throw new Error("Concurrent job conflict")
        jobs.set(id, {
          id,
          status: "completed",
          result: JSON.stringify({ stories: [story] }),
          context,
        })
        return { id, status: "queued", context }
      },
    },
  })
  const [first, second] = await Promise.all([
    service.discover({ requestId, location }),
    service.discover({ requestId, location }),
  ])
  expect(ticketOf(first)).toBe(ticketOf(second))
  const result = await service.discover({ ticket: ticketOf(second) })
  expect(result).toMatchObject({
    status: "completed",
    discovery: { stories: [{ coordinates: candidate.coordinates }] },
  })
})

it.each([
  ["research_auth", "auth"],
  ["research_timeout", "timeout"],
])("preserves terminal runner %s as public %s", async (error, code) => {
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    places: {
      nearby: vi.fn(),
      resolve: vi.fn(),
      map: vi.fn(),
      describeLocation: vi.fn(async () => "Greyfriars Kirk, Edinburgh"),
      resolveStory: vi.fn(async () => ({ id: "resolved-site", coordinates: location.coordinates })),
    },
    runner: { get: async id => ({ id, status: "failed", error }), start: vi.fn() },
  })
  await expect(
    service.chat({
      requestId,
      question: "What happened?",
      location,
      originLocation: location,
      stories: [],
      history: [],
    }),
  ).rejects.toMatchObject({ code })
})

it("correlates discovery submission timing without logging location or prompt content", async () => {
  const log = vi.spyOn(console, "log").mockImplementation(() => {})
  try {
    const { service } = setup([{ stories: [story] }])
    await service.discover({ requestId, location })
    const event = log.mock.calls
      .map(([value]) => JSON.parse(value))
      .find(value => value.phase === "discovery_submit")
    expect(event).toEqual({
      event: "research_timing",
      phase: "discovery_submit",
      requestId,
      jobId: expect.any(String),
      radiusMeters: 200,
      placesMs: expect.any(Number),
      durationMs: expect.any(Number),
    })
  } finally {
    log.mockRestore()
  }
})

it("returns stories from model knowledge without requiring source links", async () => {
  const { service } = setup([{ stories: [{ ...story, sources: [] }] }])
  const initial = await service.discover({ requestId, location })
  const result = await service.discover({ ticket: ticketOf(initial) })
  expect(result).toMatchObject({
    status: "completed",
    discovery: {
      stories: [{ title: story.title, sources: [], coordinates: location.coordinates }],
    },
  })
})
