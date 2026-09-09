import { expect, it, vi } from "vitest"
import { handleWalkingRequest } from "../handleWalkingRequest"

/** Construct a private-body walking request. */
const request = (body: unknown) =>
  new Request("https://tourist.test/api/walk", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

it("draws the provider's walking route and returns its distance and duration without credentials", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockResolvedValueOnce(
      Response.json({
        routes: [
          {
            distanceMeters: 97,
            duration: "93s",
            polyline: {
              geoJsonLinestring: {
                type: "LineString",
                coordinates: [
                  [origin.lon, origin.lat],
                  [-3.206, 55.9507],
                  [destination.lon, destination.lat],
                ],
              },
            },
          },
        ],
      }),
    )
    .mockResolvedValueOnce(
      new Response(new Uint8Array([137, 80, 78, 71]), { headers: { "Content-Type": "image/png" } }),
    )
  const response = await handleWalkingRequest(
    request({ origin, destination }),
    "private-key",
    fetcher,
  )
  expect(response.status).toBe(200)
  expect(JSON.parse(String(fetcher.mock.calls[0][1]?.body))).toMatchObject({
    travelMode: "WALK",
    origin: { location: { latLng: { latitude: origin.lat } } },
  })
  const map = new URL(String(fetcher.mock.calls[1][0]))
  expect(map.searchParams.get("center")).toBeTruthy()
  expect(response.headers.get("Content-Type")).toBe("image/svg+xml")
  const image = await response.text()
  expect(image).toContain('stroke-dasharray="0 7"')
  expect(image).toContain('stroke-linecap="round"')
  expect(image).toContain("data:image/png;base64,iVBORw==")
  expect(response.headers.get("X-Walk-Meters")).toBe("97")
  expect(response.headers.get("X-Walk-Seconds")).toBe("93")
  expect(response.headers.get("Cache-Control")).toContain("no-store")
  expect(image).not.toContain("private-key")
})

it("rejects malformed locations before contacting Google", async () => {
  const fetcher = vi.fn<typeof fetch>()
  const response = await handleWalkingRequest(
    request({ origin: { lat: 100, lon: 0 }, destination }),
    "key",
    fetcher,
  )
  expect(response.status).toBe(400)
  expect(fetcher).not.toHaveBeenCalled()
})

it("does not fabricate a route when Google returns none", async () => {
  const fetcher = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ routes: [] }))
  const response = await handleWalkingRequest(request({ origin, destination }), "key", fetcher)
  expect(response.status).toBe(502)
  expect(fetcher).toHaveBeenCalledOnce()
})

const origin = { lat: 55.95, lon: -3.206 }
const destination = { lat: 55.9507, lon: -3.2055 }
