import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ResearchFeed } from "../ResearchFeed"
import { location } from "../../data/location"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("types the location and nearby places, then keeps showing activity", async () => {
  vi.useFakeTimers()
  render(
    <ResearchFeed
      location={location}
      progress={{
        status: "running",
        radiusMeters: 200,
        nearbyPlaces: [{ name: "Memorial garden", distanceMeters: 40 }],
      }}
      google
    />,
  )
  expect(screen.queryByText(/Memorial garden/)).not.toBeInTheDocument()
  for (let step = 0; step < 250; step++) await act(() => vi.advanceTimersByTimeAsync(100))
  expect(screen.getByText(/Memorial garden \(40m\)/)).toBeVisible()
  expect(screen.getByText(/Location:/)).toHaveTextContent(location.coordinates.lat.toFixed(4))
  expect(screen.getByText(/Searching within 200m/)).toBeVisible()
  expect(screen.getByText("Google Maps")).toBeVisible()
  expect(screen.getByRole("status")).toHaveTextContent(/Researching within 200 m/)
})

it("shows the complete notebook without animation when reduced motion is preferred", () => {
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  render(<ResearchFeed location={location} progress={{ status: "running", radiusMeters: 500 }} />)
  expect(screen.getByText(/Searching within 500m/)).toHaveTextContent("expanded search")
  expect(screen.getByText("Collecting obscure facts...")).toBeVisible()
})
