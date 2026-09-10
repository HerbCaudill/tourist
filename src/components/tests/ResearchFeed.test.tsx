import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ResearchFeed } from "../ResearchFeed"
import { location } from "../../data/location"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
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
    />,
  )
  expect(screen.queryByText(/Memorial garden/)).not.toBeInTheDocument()
  for (let step = 0; step < 250; step++) await act(() => vi.advanceTimersByTimeAsync(100))
  expect(screen.getByText(/Memorial garden \(40m\)/)).toBeVisible()
  expect(screen.getByText(/Location:/)).toHaveTextContent(location.coordinates.lat.toFixed(4))
  expect(screen.getByText(/Searching within 200m/)).toBeVisible()
  expect(screen.getByRole("status")).toHaveTextContent(/Researching within 200 m/)
})

it("finishes the place list before typing, holding, and erasing a shuffled message", async () => {
  vi.useFakeTimers()
  vi.spyOn(Math, "random").mockReturnValue(0.999)
  render(
    <ResearchFeed
      location={location}
      progress={{
        status: "running",
        radiusMeters: 200,
        nearbyPlaces: [{ name: "Memorial garden", distanceMeters: 40 }],
      }}
    />,
  )
  expect(screen.queryByText("Collecting obscure facts...")).not.toBeInTheDocument()
  for (let step = 0; step < 300 && !screen.queryByText(/Memorial garden \(40m\)/); step++)
    await act(() => vi.advanceTimersByTimeAsync(40))
  expect(screen.getByText(/Memorial garden \(40m\)/)).toBeVisible()
  expect(screen.queryByText(/^Collect/)).not.toBeInTheDocument()
  for (let step = 0; step < 20; step++) await act(() => vi.advanceTimersByTimeAsync(40))
  const partial = screen.getByText(/^Coll/).textContent!
  expect("Collecting obscure facts...").toContain(partial)
  expect(partial).not.toBe("Collecting obscure facts...")
  for (let step = 0; step < 100 && !screen.queryByText("Collecting obscure facts..."); step++)
    await act(() => vi.advanceTimersByTimeAsync(40))
  expect(screen.getByText("Collecting obscure facts...")).toBeVisible()
  await act(() => vi.advanceTimersByTimeAsync(6000))
  await act(() => vi.advanceTimersByTimeAsync(40))
  expect(screen.getByText("Collecting obscure facts...")).toBeVisible()
  await act(() => vi.advanceTimersByTimeAsync(460))
  await act(() => vi.advanceTimersByTimeAsync(10))
  const erasing = screen.getByText(/^Collect/).textContent!
  expect("Collecting obscure facts...").toContain(erasing)
  expect(erasing.length).toBeLessThan("Collecting obscure facts...".length)
  for (let step = 0; step < 30 && !screen.queryByText("C", { exact: true }); step++)
    await act(() => vi.advanceTimersByTimeAsync(10))
  expect(screen.getByText("C", { exact: true })).toBeVisible()
  await act(() => vi.advanceTimersByTimeAsync(10))
  expect(screen.getByText("P", { exact: true })).toBeVisible()
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
