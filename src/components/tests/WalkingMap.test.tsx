import { render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { WalkingMap } from "../WalkingMap"

afterEach(() => vi.unstubAllGlobals())

it("links to Google Maps walking navigation with the route endpoints", () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(() => new Promise(() => {})),
  )
  render(
    <WalkingMap
      number={1}
      place="Memorial garden"
      origin={{ lat: 55.95, lon: -3.18 }}
      destination={{ lat: 55.9507, lon: -3.185 }}
    />,
  )
  const link = screen.getByRole("link", { name: /Walking directions/ })
  const url = new URL(link.getAttribute("href")!)
  expect(url.origin + url.pathname).toBe("https://www.google.com/maps/dir/")
  expect(Object.fromEntries(url.searchParams)).toEqual({
    api: "1",
    origin: "55.95,-3.18",
    destination: "55.9507,-3.185",
    travelmode: "walking",
    dir_action: "navigate",
  })
})
