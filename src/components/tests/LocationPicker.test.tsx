import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { expect, it, vi } from "vitest"
import { LocationPicker } from "../LocationPicker"
import { location } from "../../data/location"
import type { LocationPickerServices, PickerViewport } from "../../lib/locationPickerTypes"
import type { Location } from "../../types"

/** Exercise selection independently of Google's rendering and network. */
function setup(overrides: Partial<LocationPickerServices> = {}) {
  let move!: () => void
  let idle!: (viewport: PickerViewport) => void
  const map = { center: vi.fn(), setGps: vi.fn(), destroy: vi.fn() }
  const selected = {
    ...location,
    name: "Edinburgh Castle",
    coordinates: { lat: 55.9486, lon: -3.1999 },
  }
  const services: LocationPickerServices = {
    mount: vi.fn(async (_element, _initial, onMove, onIdle) => {
      expect(_element).toBeInstanceOf(HTMLElement)
      move = onMove
      idle = onIdle
      return map
    }),
    suggest: vi.fn(async () => [
      {
        id: "castle",
        name: "Edinburgh Castle",
        address: "Edinburgh, Scotland",
        resolve: async () => selected,
      },
    ]),
    describe: vi.fn(async () => "Castle Esplanade, Edinburgh"),
    ...overrides,
  }
  const onConfirm = vi.fn()
  const onCancel = vi.fn()
  const locate = vi.fn(async () => location)
  const rendered = render(
    <LocationPicker
      initial={location}
      services={services}
      locate={locate}
      resolveLocation={async () => selected}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />,
  )
  return {
    services,
    selected,
    map,
    onConfirm,
    onCancel,
    locate,
    unmount: rendered.unmount,
    move: () => move(),
    idle: (viewport: PickerViewport) => idle(viewport),
  }
}

it("previews an autocomplete result and confirms its coordinates only on Explore here", async () => {
  const user = userEvent.setup()
  const { services, selected, map, onConfirm } = setup()
  await user.type(screen.getByRole("combobox", { name: "Search for a place" }), "castle")
  await screen.findByRole("option", { name: /Edinburgh Castle/ })
  expect(services.suggest).toHaveBeenLastCalledWith(
    "castle",
    expect.objectContaining({ center: location.coordinates }),
  )
  await user.keyboard("{ArrowDown}{Enter}")
  await waitFor(() => expect(map.center).toHaveBeenCalledWith(selected))
  expect(onConfirm).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Explore here" }))
  expect(onConfirm).toHaveBeenCalledWith(selected)
})

it("uses the settled map center as the pin and as the next search bias", async () => {
  const user = userEvent.setup()
  const { services, onConfirm, move, idle } = setup()
  await waitFor(() => expect(services.mount).toHaveBeenCalled())
  act(move)
  expect(screen.getByRole("button", { name: "Explore here" })).toBeDisabled()
  const center = { lat: 41.39, lon: 2.17 }
  act(() => idle({ center, radiusMeters: 3000 }))
  await screen.findByText("Castle Esplanade, Edinburgh")
  await user.type(screen.getByRole("combobox"), "museum")
  await screen.findByRole("option")
  expect(services.suggest).toHaveBeenLastCalledWith("museum", { center, radiusMeters: 3000 })
  await user.keyboard("{Escape}")
  await user.click(screen.getByRole("button", { name: "Explore here" }))
  expect(onConfirm).toHaveBeenCalledWith(
    expect.objectContaining({ coordinates: center, name: "Dropped pin", accuracyMeters: 0 }),
  )
})

it("cancels without changing the active location", async () => {
  const user = userEvent.setup()
  const { onConfirm, onCancel } = setup()
  await user.click(screen.getByRole("button", { name: "Cancel" }))
  expect(onCancel).toHaveBeenCalledOnce()
  expect(onConfirm).not.toHaveBeenCalled()
})

it("selects the last suggestion when keyboard navigation starts with Arrow Up", async () => {
  const user = userEvent.setup()
  const last = { ...location, name: "Last place" }
  const { onConfirm } = setup({
    suggest: async () => [
      { id: "first", name: "First place", address: "", resolve: async () => location },
      { id: "last", name: "Last place", address: "", resolve: async () => last },
    ],
  })
  await user.type(screen.getByRole("combobox"), "place")
  await screen.findByRole("option", { name: "Last place" })
  await user.keyboard("{ArrowUp}{Enter}")
  await user.click(screen.getByRole("button", { name: "Explore here" }))
  expect(onConfirm).toHaveBeenCalledWith(last)
})

it("discards autocomplete results that arrive after the search was cleared", async () => {
  const user = userEvent.setup()
  let finish!: (value: Awaited<ReturnType<LocationPickerServices["suggest"]>>) => void
  const suggest = vi.fn(
    () =>
      new Promise<Awaited<ReturnType<LocationPickerServices["suggest"]>>>(resolve => {
        finish = resolve
      }),
  )
  setup({ suggest })
  await user.type(screen.getByRole("combobox"), "castle")
  await waitFor(() => expect(suggest).toHaveBeenCalled())
  await user.click(screen.getByRole("button", { name: "Clear search" }))
  await act(async () =>
    finish([{ id: "late", name: "Old suggestion", address: "", resolve: async () => location }]),
  )
  expect(screen.queryByRole("option")).not.toBeInTheDocument()
  expect(screen.getByRole("button", { name: "Explore here" })).toBeEnabled()
})

it("ignores a late place resolution after the user moves the map", async () => {
  const user = userEvent.setup()
  let finish!: (where: Location) => void
  const { move, idle, onConfirm } = setup({
    suggest: async () => [
      {
        id: "slow",
        name: "Slow place",
        address: "",
        resolve: () =>
          new Promise(resolve => {
            finish = resolve
          }),
      },
    ],
  })
  await user.type(screen.getByRole("combobox"), "slow")
  await user.click(await screen.findByRole("option"))
  const center = { lat: 41.39, lon: 2.17 }
  act(() => {
    move()
    idle({ center, radiusMeters: 1000 })
  })
  await act(async () => finish(location))
  await user.click(screen.getByRole("button", { name: "Clear search" }))
  await user.click(screen.getByRole("button", { name: "Explore here" }))
  expect(onConfirm).toHaveBeenCalledWith(expect.objectContaining({ coordinates: center }))
})

it("keeps a dropped pin usable when reverse geocoding fails", async () => {
  const user = userEvent.setup()
  const { services, move, idle, onConfirm } = setup({
    describe: vi.fn().mockRejectedValue(new Error("No address")),
  })
  await waitFor(() => expect(services.mount).toHaveBeenCalled())
  const center = { lat: 55.949, lon: -3.2 }
  act(() => {
    move()
    idle({ center, radiusMeters: 1000 })
  })
  await user.click(screen.getByRole("button", { name: "Explore here" }))
  expect(onConfirm).toHaveBeenCalledWith(
    expect.objectContaining({ name: "Dropped pin", coordinates: center }),
  )
})

it("previews GPS only on request, then leaves its blue dot at the device position when the map moves", async () => {
  const user = userEvent.setup()
  const { locate, map, onConfirm, move, idle, unmount } = setup()
  expect(locate).not.toHaveBeenCalled()
  await user.click(screen.getByRole("button", { name: "Use my current location" }))
  expect(map.setGps).toHaveBeenCalledWith(location)
  expect(onConfirm).not.toHaveBeenCalled()
  act(() => {
    move()
    idle({ center: { lat: 41, lon: 2 }, radiusMeters: 1000 })
  })
  expect(map.setGps).toHaveBeenCalledOnce()
  unmount()
  expect(map.destroy).toHaveBeenCalledOnce()
})
