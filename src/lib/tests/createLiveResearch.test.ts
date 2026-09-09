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
  promptVersion: "ledger-1",
}

describe("live discovery adapter", () => {
  it("polls server tickets, reports expansion, and returns real results", async () => {
    const transport = vi
      .fn()
      .mockResolvedValueOnce(
        Response.json({ status: "queued", ticket: "first", retryAfterMs: 5000, radiusMeters: 200 }),
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
})
