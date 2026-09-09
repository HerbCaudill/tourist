import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { App } from "../App"
import { location } from "../data/location"
import type { Discovery, Location } from "../types"
import { createFakeResearch } from "../lib/createFakeResearch"
import { ResearchClientError } from "../lib/ResearchClientError"

describe("live discovery states", () => {
  it.each(["malformed", "expired", "timeout", "auth"])(
    "starts fresh research when retrying a %s result",
    async code => {
      const user = userEvent.setup()
      const fake = createFakeResearch({ delayMs: 0 })
      const research = {
        ...fake,
        discover: vi
          .fn()
          .mockRejectedValueOnce(new ResearchClientError(code, "Research failed"))
          .mockImplementation(fake.discover),
      }
      render(<App research={research} />)
      await screen.findByRole("alert")
      await user.click(screen.getByRole("button", { name: "Try again" }))
      expect(await screen.findByRole("button", { name: /worst poet/ })).toBeVisible()
      expect(research.discover.mock.calls[1][1].requestId).not.toBe(
        research.discover.mock.calls[0][1].requestId,
      )
      expect(research.discover.mock.calls[1][0]).toEqual(research.discover.mock.calls[0][0])
    },
  )

  it("accepts a typed place during GPS lookup and ignores its late result", async () => {
    const user = userEvent.setup()
    let finishGps!: (value: Location) => void
    const fake = createFakeResearch({ delayMs: 0 })
    const chosen = { ...location, name: "Edinburgh Castle" }
    const research = {
      ...fake,
      locate: vi.fn(
        () =>
          new Promise<Location>(resolve => {
            finishGps = resolve
          }),
      ),
      resolveLocation: vi.fn().mockResolvedValue(chosen),
      discover: vi.fn(fake.discover),
    }
    render(<App research={research} />)
    await waitFor(() => expect(research.locate).toHaveBeenCalledOnce())
    await user.type(screen.getByRole("textbox", { name: "Enter a place" }), "Edinburgh Castle")
    await user.click(screen.getByRole("button", { name: "Search" }))
    await waitFor(() => expect(research.resolveLocation).toHaveBeenCalledWith("Edinburgh Castle"))
    await screen.findByRole("button", { name: /worst poet/ })
    await act(async () => finishGps(location))
    expect(research.discover).toHaveBeenCalledOnce()
    expect(research.discover.mock.calls[0][0]).toEqual(chosen)
    expect(screen.getByRole("textbox", { name: "Enter a place" })).toHaveAttribute(
      "placeholder",
      "edinburgh castle",
    )
  })

  it("offers a place fallback when location permission fails and discovers there", async () => {
    const user = userEvent.setup()
    const research = {
      ...createFakeResearch({ delayMs: 0 }),
      locate: vi.fn().mockRejectedValue(new Error("Location access was denied.")),
      resolveLocation: vi.fn().mockResolvedValue(location),
    }
    render(<App research={research} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Location access was denied.")
    await user.type(
      screen.getByRole("textbox", { name: "Enter a place" }),
      "Candlemaker Row{enter}",
    )
    expect(await screen.findByText("The worst poet in the world is buried here")).toBeVisible()
    expect(research.resolveLocation).toHaveBeenCalledWith("Candlemaker Row")
  })

  it("keeps an open story when replacement discovery no longer contains it", async () => {
    const user = userEvent.setup()
    const original = createFakeResearch({ delayMs: 0 })
    const { rerender } = render(<App research={original} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    const replacement = {
      ...original,
      discover: vi
        .fn()
        .mockResolvedValue({ location, stories: [], radiusMeters: 1000, researchedAt: new Date() }),
    }
    rerender(<App research={replacement} />)
    await waitFor(() => expect(replacement.discover).toHaveBeenCalled())
    expect(screen.getByText(/Dundee handloom weaver/)).toBeVisible()
  })
  it("offers a fallback without researching an imprecise browser position", async () => {
    const research = {
      ...createFakeResearch({ delayMs: 0 }),
      locate: vi.fn().mockResolvedValue({ ...location, accuracyMeters: 900 }),
      discover: vi.fn(),
    }
    render(<App research={research} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("accurate to about 900 m")
    expect(screen.getByRole("textbox", { name: "Enter a place" })).toBeVisible()
    expect(research.discover).not.toHaveBeenCalled()
  })

  it("retries a failed discovery with the same request ID", async () => {
    const user = userEvent.setup()
    const fake = createFakeResearch({ delayMs: 0 })
    const research = {
      ...fake,
      discover: vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection lost"))
        .mockImplementation(fake.discover),
    }
    render(<App research={research} />)
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection lost")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("button", { name: /worst poet/ })).toBeVisible()
    expect(research.discover.mock.calls[1][1].requestId).toBe(
      research.discover.mock.calls[0][1].requestId,
    )
  })

  it("keeps old origins during movement and ignores superseded results", async () => {
    const user = userEvent.setup()
    const fake = createFakeResearch({ delayMs: 0 })
    const first = await fake.discover(location)
    let finishOld!: (value: Discovery) => void
    let finishNew!: (value: Discovery) => void
    const research = {
      ...fake,
      discover: vi
        .fn()
        .mockResolvedValueOnce(first)
        .mockImplementationOnce(
          () =>
            new Promise<Discovery>(resolve => {
              finishOld = resolve
            }),
        ),
    }
    const { rerender } = render(<App research={research} />)
    await user.click(await screen.findByRole("button", { name: "Refresh" }))
    await waitFor(() => expect(research.discover).toHaveBeenCalledTimes(2))
    const newLocation = {
      ...location,
      name: "Castle Esplanade",
      coordinates: { lat: 55.9486, lon: -3.1984 },
    }
    const replacement = {
      ...fake,
      locate: vi.fn().mockResolvedValue(newLocation),
      discover: vi.fn().mockImplementation(
        () =>
          new Promise<Discovery>(resolve => {
            finishNew = resolve
          }),
      ),
    }
    rerender(<App research={replacement} />)
    await waitFor(() => expect(replacement.discover).toHaveBeenCalled())
    expect(screen.getByRole("button", { name: /worst poet/ })).toBeVisible()
    await act(async () =>
      finishNew({ ...first, location: newLocation, stories: [], radiusMeters: 1000 }),
    )
    expect(screen.getByText(/Nothing worth telling within 1\.0 km/)).toBeVisible()
    await act(async () => finishOld(first))
    expect(screen.queryByRole("button", { name: /worst poet/ })).not.toBeInTheDocument()
  })
  it("does not submit the same typed place twice while its research is running", async () => {
    const user = userEvent.setup()
    const fake = createFakeResearch({ delayMs: 0 })
    const research = {
      ...fake,
      locate: vi.fn().mockRejectedValue(new Error("Location denied")),
      discover: vi.fn().mockImplementation(() => new Promise<Discovery>(() => {})),
    }
    render(<App research={research} />)
    await screen.findByRole("alert")
    await user.type(
      screen.getByRole("textbox", { name: "Enter a place" }),
      "Edinburgh Castle{enter}",
    )
    await waitFor(() => expect(research.discover).toHaveBeenCalledTimes(1))
    await user.type(screen.getByRole("textbox", { name: "Enter a place" }), "{enter}")
    expect(research.discover).toHaveBeenCalledTimes(1)
  })
  it("retries a failed typed location without returning to denied GPS", async () => {
    const user = userEvent.setup()
    const fake = createFakeResearch({ delayMs: 0 })
    const research = {
      ...fake,
      locate: vi.fn().mockRejectedValue(new Error("Location denied")),
      resolveLocation: vi
        .fn()
        .mockRejectedValueOnce(new Error("Location service unavailable"))
        .mockResolvedValue(location),
    }
    render(<App research={research} />)
    await screen.findByRole("alert")
    await user.type(
      screen.getByRole("textbox", { name: "Enter a place" }),
      "Candlemaker Row{enter}",
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("Location service unavailable")
    await user.click(screen.getByRole("button", { name: "Try again" }))
    expect(await screen.findByRole("button", { name: /worst poet/ })).toBeVisible()
    expect(research.resolveLocation).toHaveBeenCalledTimes(2)
    expect(research.resolveLocation).toHaveBeenLastCalledWith("Candlemaker Row")
    expect(research.locate).toHaveBeenCalledTimes(1)
  })
})
