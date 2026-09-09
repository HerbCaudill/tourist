import { fireEvent, render, screen } from "@testing-library/react"
import { expect, it, vi } from "vitest"
import { MiniMap } from "../MiniMap"

vi.mock("../../hooks/useElementWidth", () => ({ useElementWidth: () => [{ current: null }, 320] }))

it("keeps locations visible and reports failed tiles with GPS uncertainty", () => {
  const { container } = render(
    <MiniMap
      you={{ lat: 55.95, lon: -3.19 }}
      radiusMeters={500}
      accuracyMeters={40}
      markers={[{ label: "1", coordinates: { lat: 55.951, lon: -3.19 } }]}
    />,
  )
  fireEvent.error(container.querySelector("img")!)
  expect(screen.getByRole("status")).toHaveTextContent("Map tiles unavailable")
  expect(screen.getByRole("img")).toHaveAccessibleName(
    "Map of stories within 500 m; location accuracy approximately 40 m",
  )
  expect(screen.getByText("1")).toBeVisible()
  expect(screen.getByRole("link", { name: "© OpenStreetMap" })).toBeVisible()
})
