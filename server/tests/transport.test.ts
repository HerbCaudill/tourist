// @vitest-environment node
import { describe, expect, it, vi } from "vitest"
import { createRunnerAdapter } from "../createRunnerAdapter.ts"
import { createPlacesAdapter } from "../createPlacesAdapter.ts"
import { handleResearchRequest } from "../handleResearchRequest.ts"
import { createResearchService } from "../createResearchService.ts"
import { ResearchError } from "../ResearchError.ts"

/** Make a JSON request without storing location in its URL. */
function request(body: unknown) {
  return new Request("https://tourist.example/api/discover", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })
}

const point = { lat: 55.946, lon: -3.192 }

describe("public HTTP boundary", () => {
  it("rejects oversized, malformed and wrong-method requests before reading private credentials", async () => {
    const factory = vi.fn()
    expect(
      (await handleResearchRequest(request({ data: "x".repeat(90_000) }), "discover", factory))
        .status,
    ).toBe(400)
    expect(
      (
        await handleResearchRequest(
          new Request("https://tourist.example/api/discover"),
          "discover",
          factory,
        )
      ).status,
    ).toBe(405)
    expect(factory).not.toHaveBeenCalled()
  })

  it("returns controlled errors with no-store headers and no private provider diagnostics", async () => {
    const response = await handleResearchRequest(request({}), "discover", () => {
      throw new Error("private-token-and-location")
    })
    expect(response.status).toBe(503)
    expect(response.headers.get("cache-control")).toContain("no-store")
    expect(await response.text()).not.toContain("private-token-and-location")
  })

  it("returns recoverable busy feedback without treating it as an authentication failure", async () => {
    const response = await handleResearchRequest(request({}), "discover", () => {
      throw new ResearchError("busy")
    })
    expect(response.status).toBe(429)
    expect(await response.json()).toMatchObject({ error: { code: "busy", retryable: true } })
  })
})

describe("private runner adapter", () => {
  it("uses only authenticated persisted research endpoints and treats an absent job as missing", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response("", { status: 404 }))
      .mockResolvedValueOnce(Response.json({ id: "id-1", status: "queued" }))
    const runner = createRunnerAdapter("https://runner.example", "secret-token", fetcher)
    expect(await runner.get("id-1")).toBeNull()
    expect(await runner.start("id-1", "Research prompt")).toEqual({ id: "id-1", status: "queued" })
    const [url, init] = fetcher.mock.calls[1]!
    expect(String(url)).toBe("https://runner.example/v1/research/jobs")
    expect(init?.headers).toMatchObject({ Authorization: "Bearer secret-token" })
    expect(JSON.parse(String(init?.body))).toEqual({ id: "id-1", prompt: "Research prompt" })
  })

  it.each([
    [401, "auth"],
    [409, "busy"],
    [504, "timeout"],
    [500, "unavailable"],
  ])("sanitizes upstream HTTP %s as %s", async (status, code) => {
    const runner = createRunnerAdapter(
      "https://runner.example",
      "secret",
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response("private error", { status: Number(status) })),
    )
    await expect(runner.get("id")).rejects.toMatchObject({ code })
  })
})

describe("narrow Google adapter", () => {
  it.each(["street_address", "intersection", "premise", "establishment"])(
    "geocodes an ordinary %s as an independent story site",
    async type => {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
        Response.json({
          status: "OK",
          results: [
            {
              place_id: "ordinary-site",
              types: [type],
              geometry: {
                location: { lat: point.lat, lng: point.lon },
                viewport: {
                  northeast: { lat: point.lat + 0.001, lng: point.lon + 0.001 },
                  southwest: { lat: point.lat - 0.001, lng: point.lon - 0.001 },
                },
              },
            },
          ],
        }),
      )
      const query = "Candlemaker Row and Cowgate, Edinburgh, Scotland"
      expect(await createPlacesAdapter("key", fetcher).resolveStory(query)).toEqual({
        id: "ordinary-site",
        coordinates: point,
      })
      expect(new URL(String(fetcher.mock.calls[0]?.[0])).searchParams.get("address")).toBe(query)
    },
  )

  it.each([
    { status: "ZERO_RESULTS", results: [] },
    ...[
      { types: ["locality"] },
      { types: ["route"] },
      { types: ["street_address"], partial_match: true },
    ].map(fields => ({
      status: "OK",
      results: [
        {
          place_id: "imprecise-site",
          ...fields,
          geometry: {
            location: { lat: point.lat, lng: point.lon },
            viewport: {
              northeast: { lat: point.lat, lng: point.lon },
              southwest: { lat: point.lat, lng: point.lon },
            },
          },
        },
      ],
    })),
  ])("leaves unmatched or broad story locations unresolved: %j", async response => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json(response))
    expect(await createPlacesAdapter("key", fetcher).resolveStory("An uncertain site")).toBeNull()
  })

  it("uses provider IDs/coordinates as anchors and requests no descriptions or reviews", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        places: [
          {
            id: "place-1",
            displayName: { text: "Temporary Google name", languageCode: "en" },
            formattedAddress: "1 Candlemaker Row, Edinburgh, Scotland",
            location: { latitude: point.lat, longitude: point.lon },
          },
        ],
      }),
    )
    const adapter = createPlacesAdapter("private-google-key", fetcher)
    expect(
      await adapter.nearby(
        { name: "My landmark", area: "", coordinates: point, accuracyMeters: 20 },
        200,
      ),
    ).toEqual([
      {
        id: "place-1",
        name: "Temporary Google name",
        address: "1 Candlemaker Row, Edinburgh, Scotland",
        coordinates: point,
      },
    ])
    expect(fetcher.mock.calls[0]?.[1]?.headers).toMatchObject({
      "X-Goog-FieldMask": "places.id,places.displayName,places.formattedAddress,places.location",
    })
    expect(
      JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body)).locationRestriction.circle.radius,
    ).toBe(200)
  })

  it("preserves a typed label while discarding provider addresses and other geocoding metadata", async () => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({
        status: "OK",
        results: [
          {
            formatted_address: "Provider-only address",
            place_id: "private-place",
            geometry: {
              location: { lat: point.lat, lng: point.lon },
              viewport: {
                northeast: { lat: point.lat + 0.001, lng: point.lon + 0.001 },
                southwest: { lat: point.lat - 0.001, lng: point.lon - 0.001 },
              },
              location_type: "ROOFTOP",
            },
          },
        ],
      }),
    )
    const result = await createPlacesAdapter("key", fetcher).resolve("My landmark")
    expect(result).toMatchObject({ name: "My landmark", area: "", coordinates: point })
    expect(JSON.stringify(result)).not.toMatch(/Provider-only|private-place/)
  })

  it("frames nearby markers tightly while keeping distant markers visible", async () => {
    const center = { lat: 55.95, lon: -3.18 }
    const fetcher = vi.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(new Uint8Array([137, 80, 78, 71]), {
          headers: { "Content-Type": "image/png" },
        }),
    )
    const places = createPlacesAdapter("key", fetcher)
    await places.map(
      center,
      [
        { lat: 55.9509, lon: -3.18 },
        { lat: 55.9495, lon: -3.181 },
        { lat: 55.9495, lon: -3.1805 },
      ],
      1000,
    )
    await places.map(center, [{ lat: 55.958, lon: -3.18 }], 1000)
    const close = new URL(String(fetcher.mock.calls[0]?.[0]))
    const far = new URL(String(fetcher.mock.calls[1]?.[0]))
    expect(close.searchParams.get("size")).toBe("640x420")
    expect(Number(close.searchParams.get("zoom"))).toBe(17)
    expect(Number(far.searchParams.get("zoom"))).toBeLessThanOrEqual(14)
  })

  it("returns whole attributed image bytes, leaving the key only on the private provider request", async () => {
    const bytes = new Uint8Array([137, 80, 78, 71])
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(bytes, { headers: { "Content-Type": "image/png" } }))
    const result = await createPlacesAdapter("private-google-key", fetcher).map(point, [point], 200)
    expect(new Uint8Array(result)).toEqual(bytes)
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("key=private-google-key")
  })
})

it("does not allow chat tickets to be used as discovery tickets", async () => {
  const service = createResearchService({
    secret: "long-private-test-secret-32-characters",
    runner: { get: async () => null, start: async id => ({ id, status: "queued" }) },
    places: {
      nearby: vi.fn(),
      resolve: vi.fn(),
      map: vi.fn(),
      resolveStory: vi.fn(async () => ({ id: "resolved-site", coordinates: point })),
    },
  })
  const chat = await service.chat({
    requestId: "13516742-4173-49c5-ae65-376e147c4dad",
    question: "What happened?",
    location: { name: "Here", area: "", coordinates: point, accuracyMeters: 10 },
    originLocation: { name: "Here", area: "", coordinates: point, accuracyMeters: 10 },
    stories: [],
    history: [],
  })
  if (chat.status === "completed") throw new Error("Expected pending chat")
  await expect(service.discover({ ticket: chat.ticket })).rejects.toMatchObject({ code: "expired" })
})
