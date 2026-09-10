// @vitest-environment node
import { expect, it, vi } from "vitest"
import { createPlacesAdapter } from "../createPlacesAdapter.ts"

/** Make a provider result at a controllable distance from the origin. */
function place(id: string, offset = 0) {
  return {
    id,
    displayName: { text: id },
    location: { latitude: origin.coordinates.lat + offset, longitude: origin.coordinates.lon },
  }
}

const origin = {
  name: "Here",
  area: "",
  coordinates: { lat: 55.9487, lon: -3.1796 },
  accuracyMeters: 10,
}

it("starts both searches together and fills around priority landmarks with distinct nearby places", async () => {
  const releases: Array<() => void> = []
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    (_url, init) =>
      new Promise(resolve => {
        const types = JSON.parse(String(init?.body)).includedTypes ?? []
        const places = types.includes("cafe")
          ? [
              place("wall", 0.0015),
              ...Array.from({ length: 11 }, (_, i) => place(`cafe-${i}`, i * 0.00001)),
            ]
          : [place("wall", 0.0015), place("garden", 0.001)]
        releases.push(() => resolve(Response.json({ places })))
      }),
  )
  const result = createPlacesAdapter("key", fetcher).nearby(origin, 200)
  expect(fetcher).toHaveBeenCalledTimes(2)
  releases.forEach(release => release())
  const places = await result
  expect(places.map(place => place.id)).toEqual([
    ...Array.from({ length: 10 }, (_, i) => `cafe-${i}`),
    "garden",
    "wall",
  ])
})

it.each([true, false])(
  "uses the successful search when the broad search fails: %s",
  async broadFails => {
    const fetcher = vi.fn<typeof fetch>().mockImplementation(async (_url, init) => {
      const broad = JSON.parse(String(init?.body)).includedTypes?.includes("cafe") ?? false
      return broad === broadFails
        ? new Response("Unavailable", { status: 503 })
        : Response.json({ places: [place("survivor")] })
    })
    expect(await createPlacesAdapter("key", fetcher).nearby(origin, 200)).toMatchObject([
      { id: "survivor" },
    ])
  },
)

it("reports an error when both searches fail", async () => {
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementation(async () => new Response("Unavailable", { status: 503 }))
  await expect(createPlacesAdapter("key", fetcher).nearby(origin, 200)).rejects.toMatchObject({
    code: "unavailable",
  })
})
