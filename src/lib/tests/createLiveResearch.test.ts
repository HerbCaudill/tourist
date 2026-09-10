import { describe, expect, it, vi } from "vitest"
import { createLiveResearch } from "../createLiveResearch"
import { location } from "../../data/location"

const requestId = "073a4b67-d9ca-4229-a693-fb74291f7e57"
const discovery = {
  location,
  stories: [],
  radiusMeters: 1000,
  researchedAt: "2026-09-09T12:00:00Z",
  coordinatesExpireAt: "2026-10-08T12:00:00Z",
  promptVersion: "ledger-4",
}

describe("live discovery adapter", () => {
  it("polls server tickets, reports expansion, and returns real results", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "queued",
          ticket: "first",
          retryAfterMs: 5000,
          radiusMeters: 200,
          nearbyPlaces: [{ name: "Memorial garden", distanceMeters: 40 }],
        }),
      )
      .mockResolvedValueOnce(
        Response.json({
          status: "running",
          ticket: "expanded",
          retryAfterMs: 5000,
          radiusMeters: 1000,
        }),
      )
      .mockResolvedValueOnce(Response.json({ status: "completed", discovery }))
    const progress = vi.fn()
    const research = createLiveResearch({ fetch: transport, wait: async () => {} })
    const result = await research.discover(location, { requestId, onProgress: progress })
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ requestId, location })
    expect(JSON.parse(transport.mock.calls[1][1].body)).toEqual({ ticket: "first" })
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({ ticket: "expanded" })
    expect(progress).toHaveBeenLastCalledWith({ status: "running", radiusMeters: 1000 })
    expect(progress).toHaveBeenNthCalledWith(1, {
      status: "queued",
      radiusMeters: 200,
      nearbyPlaces: [{ name: "Memorial garden", distanceMeters: 40 }],
    })
    expect(result.radiusMeters).toBe(1000)
    expect(result.mapProvider).toBe("google")
    expect(result.researchedAt).toEqual(new Date(discovery.researchedAt))
    expect(result.stories).toEqual([])
  })

  it("reconnects with the retained ticket after a network failure", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ status: "queued", ticket: "saved", retryAfterMs: 5000, radiusMeters: 200 }),
      )
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(Response.json({ status: "completed", discovery }))
    const research = createLiveResearch({ fetch: transport, wait: async () => {} })
    await expect(research.discover(location, { requestId })).rejects.toThrow("connection")
    await research.discover(location, { requestId })
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({ ticket: "saved" })
  })

  it("rejects malformed results and exposes a controlled backend failure", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          discovery: { ...discovery, researchedAt: "invalid" },
        }),
      )
      .mockResolvedValueOnce(
        Response.json(
          {
            error: {
              code: "busy",
              message: "Research is busy. Try again shortly.",
              retryable: true,
            },
          },
          { status: 429 },
        ),
      )
    const research = createLiveResearch({ fetch: transport, wait: async () => {} })
    await expect(research.discover(location)).rejects.toThrow("valid")
    await expect(research.discover(location)).rejects.toThrow("busy")
  })

  it("resolves a typed place through the backend", async () => {
    const transport = vi.fn().mockResolvedValue(Response.json(location))
    const research = createLiveResearch({ fetch: transport })
    expect(await research.resolveLocation("Candlemaker Row")).toEqual(location)
    expect(transport.mock.calls[0][0]).toBe("/api/location")
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual({ query: "Candlemaker Row" })
  })
  it("sends explicit chat context and reconnects a failed poll with its saved ticket", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ status: "queued", ticket: "chat-ticket", retryAfterMs: 5000 }),
      )
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(
        Response.json({
          status: "completed",
          answer: {
            text: "Sourced answer",
            sources: [{ name: "Source", org: "Archive", url: "https://example.com/source" }],
          },
        }),
      )
    const research = createLiveResearch({ fetch: transport, wait: async () => {} })
    const request = {
      requestId,
      question: "What happened?",
      location,
      originLocation: { ...location, name: "Original place" },
      stories: [],
      history: [{ role: "user" as const, text: "Earlier question" }],
    }
    await expect(research.ask(request)).rejects.toThrow("connection")
    const answer = await research.ask(request)
    expect(JSON.parse(transport.mock.calls[0][1].body)).toEqual(request)
    expect(JSON.parse(transport.mock.calls[2][1].body)).toEqual({ ticket: "chat-ticket" })
    expect(answer.sources[0].url).toBe("https://example.com/source")
  })
  it("bounds UTF-8 chat context while retaining the selected story and a source", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(
        Response.json({ status: "completed", answer: { text: "Answer", sources: [] } }),
      )
    const research = createLiveResearch({ fetch: transport })
    const story = {
      id: "selected",
      placeId: "place",
      place: "Place",
      coordinates: location.coordinates,
      distanceMeters: 20,
      bearing: "N",
      title: "Title",
      preview: "Preview",
      account: Array.from({ length: 8 }, () => "古".repeat(3000)),
      sources: Array.from({ length: 8 }, () => ({
        name: "Source",
        org: "Archive",
        url: "https://example.com/" + "古".repeat(1900),
      })),
      suggestedQuestions: [],
      timeSensitive: false,
    }
    await research.ask({
      requestId,
      question: "Question",
      location,
      originLocation: location,
      stories: [story, { ...story, id: "other" }],
      selectedStoryId: "selected",
      history: Array.from({ length: 12 }, () => ({
        role: "user" as const,
        text: "古".repeat(6000),
      })),
    })
    const body = transport.mock.calls[0][1].body
    expect(new TextEncoder().encode(body).byteLength).toBeLessThanOrEqual(68_000)
    const request = JSON.parse(body)
    expect(request.stories[0].id).toBe("selected")
    expect(request.stories[0].account.length).toBeGreaterThan(0)
    expect(request.stories[0].sources.length).toBeGreaterThan(0)
  })
  it("marks an expired server job for a fresh retry", async () => {
    const transport = vi
      .fn()
      .mockResolvedValue(Response.json({ error: { code: "expired" } }, { status: 410 }))
    const research = createLiveResearch({ fetch: transport })
    await expect(
      research.ask({
        requestId,
        question: "Question",
        location,
        originLocation: location,
        stories: [],
        history: [],
      }),
    ).rejects.toMatchObject({ code: "expired", restartRequired: true })
  })
})
