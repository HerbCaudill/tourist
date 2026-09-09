// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { createResearchService } from "../createResearchService.ts"

/** Exercise discovery against a persistent runner without network dependencies. */
function setup(results: unknown[]) {
  const jobs = new Map<string, { id: string; status: "completed"; result: string }>()
  const nearby = vi.fn(async () => [candidate])
  const start = vi.fn(async (id: string, _prompt: string) => {
    jobs.set(id, { id, status: "completed", result: JSON.stringify(results.shift()) })
    return { id, status: "queued" as const }
  })
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    now: () => new Date("2026-09-09T13:00:00Z"),
    places: { nearby, resolve: vi.fn(), map: vi.fn() },
    runner: { start, get: async (id: string) => jobs.get(id) ?? null },
  })
  return { service, nearby, start }
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
  placeId: candidate.id,
  place: "A churchyard",
  title: "A memorable story",
  preview: "A supported preview.",
  account: ["A sourced historical account."],
  kind: "documented",
  sources: [{ name: "History", org: "Archive", url: "https://example.org/history" }],
  suggestedQuestions: ["What happened next?"],
  timeSensitive: false,
}
const requestId = "13516742-4173-49c5-ae65-376e147c4dad"

describe("persistent discovery", () => {
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
    await expect(service.discover({ ticket: ticketOf(initial) + "x" })).rejects.toMatchObject({
      code: "expired",
    })
    await expect(
      service.discover({ requestId, location, radiusMeters: 1000 }),
    ).rejects.toMatchObject({ code: "invalid" })
  })
})

it("safely replays a submitted request after losing its first response", async () => {
  const { service, start } = setup([{ stories: [story] }])
  await service.discover({ requestId, location })
  const replay = await service.discover({ requestId, location })
  const done = await service.discover({ ticket: ticketOf(replay) })
  expect(done).toMatchObject({ status: "completed", discovery: { stories: [{ id: story.id }] } })
  expect(start).toHaveBeenCalledTimes(1)
})

it("never attaches model-invented places, and returns a genuine empty result at one kilometer", async () => {
  const { service, nearby } = setup([
    { stories: [{ ...story, placeId: "invented" }] },
    { stories: [] },
    { stories: [] },
  ])
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
  const start = vi.fn(async (id: string) => ({ id, status: "queued" as const }))
  const service = createResearchService({
    secret: "test-secret-with-at-least-32-characters",
    places: { nearby: async () => [candidate], resolve: vi.fn(), map: vi.fn() },
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
    places: { nearby: async () => [candidate], resolve: vi.fn(), map: vi.fn() },
    runner: { start: async id => ({ id, status: "queued" }), get: async () => null },
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
  const input = {
    requestId,
    question: "What happened next?",
    location,
    stories: [{ ...story, coordinates: location.coordinates, distanceMeters: 0, bearing: "N" }],
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
  expect(start.mock.calls[0]?.[1]).toContain(story.id)
  await expect(
    service.chat({ ...input, history: Array.from({ length: 13 }, () => input.history[0]) }),
  ).rejects.toMatchObject({ code: "invalid" })
})
