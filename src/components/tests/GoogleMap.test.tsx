import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { GoogleMap } from "../GoogleMap"
import { location } from "../../data/location"

afterEach(() => vi.unstubAllGlobals())

describe("Google map recovery", () => {
  it("shows a recovered map when returning to a previously failed location", async () => {
    vi.stubGlobal("URL", {
      createObjectURL: vi.fn().mockReturnValue("blob:map"),
      revokeObjectURL: vi.fn(),
    })
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValueOnce(new Response(null, { status: 503 }))
        .mockImplementation(
          async () => new Response("image", { headers: { "Content-Type": "image/png" } }),
        ),
    )
    const { rerender } = render(<GoogleMap location={location} stories={[]} radiusMeters={200} />)
    expect(await screen.findByText(/Map unavailable/)).toBeVisible()
    rerender(
      <GoogleMap
        location={{ ...location, coordinates: { lat: 55.94, lon: -3.2 } }}
        stories={[]}
        radiusMeters={200}
      />,
    )
    expect(await screen.findByRole("img")).toBeVisible()
    rerender(<GoogleMap location={location} stories={[]} radiusMeters={200} />)
    expect(await screen.findByRole("img")).toBeVisible()
  })
})
