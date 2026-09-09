import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { App } from "../App"
import { createFakeResearch } from "../lib/createFakeResearch"
import { createHistoryStore } from "../lib/createHistoryStore"
import { location } from "../data/location"
import type { Discovery } from "../types"

afterEach(() => vi.restoreAllMocks())

/** Provide independently stored, valid live-shaped reading data. */
async function setup() {
  const fake = createFakeResearch({ delayMs: 0 })
  const original = await fake.discover(location)
  const discovery: Discovery = {
    ...original,
    stories: original.stories.map(story => ({
      ...story,
      placeId: story.id,
      timeSensitive: false,
      suggestedQuestions: story.suggestedQuestions?.slice(0, 3),
      sources: story.sources.map(source => ({ ...source, url: "https://example.com/source" })),
    })),
    coordinatesExpireAt: new Date(Date.now() + 29 * 86_400_000).toISOString(),
    promptVersion: "ledger-1",
    mapProvider: "google",
  }
  const values = new Map<string, string>()
  const storage = {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
  }
  return { fake, discovery, store: createHistoryStore({ storage }), storage }
}

describe("saved reading", () => {
  it("reopens full stories offline and clears both saved and visible history", async () => {
    const user = userEvent.setup()
    const { fake, discovery, store, storage } = await setup()
    store.saveDiscovery(discovery)
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    const research = { ...fake, locate: vi.fn(), discover: vi.fn() }
    const { unmount } = render(
      <App research={research} history={createHistoryStore({ storage })} />,
    )
    expect(screen.getByText(/You're offline/)).toBeVisible()
    await user.click(screen.getByRole("button", { name: /worst poet/ }))
    expect(screen.getByText(/Dundee handloom weaver/)).toBeVisible()
    expect(screen.getByPlaceholderText("ask a follow-up")).toBeDisabled()
    await user.click(screen.getByRole("button", { name: /back/ }))
    await user.click(screen.getByText("Saved reading"))
    await user.click(screen.getByRole("button", { name: "Clear history" }))
    expect(screen.queryByRole("button", { name: /worst poet/ })).not.toBeInTheDocument()
    unmount()
    expect(createHistoryStore({ storage }).read().discoveries).toEqual([])
    expect(research.locate).not.toHaveBeenCalled()
    expect(research.discover).not.toHaveBeenCalled()
  })

  it("reuses matching recent research after foreground GPS refresh without interrupting a reader", async () => {
    const user = userEvent.setup()
    const { fake, discovery, store } = await setup()
    store.saveDiscovery(discovery)
    const research = { ...fake, locate: vi.fn().mockResolvedValue(location), discover: vi.fn() }
    render(<App research={research} history={store} />)
    await user.click(screen.getByRole("button", { name: /worst poet/ }))
    await act(async () => document.dispatchEvent(new Event("visibilitychange")))
    expect(screen.getByText(/Dundee handloom weaver/)).toBeVisible()
    expect(research.locate).toHaveBeenCalledTimes(2)
    expect(research.discover).not.toHaveBeenCalled()
  })
  it("reconnects one saved discovery UUID after reopening without asking for location again", async () => {
    const { fake, discovery, store, storage } = await setup()
    const first = {
      ...fake,
      discover: vi.fn().mockImplementation(() => new Promise<Discovery>(() => {})),
    }
    const mounted = render(<App research={first} history={store} />)
    await waitFor(() => expect(first.discover).toHaveBeenCalledOnce())
    const requestId = first.discover.mock.calls[0][1].requestId
    expect(store.read().pendingDiscovery?.requestId).toBe(requestId)
    mounted.unmount()
    const next = { ...fake, locate: vi.fn(), discover: vi.fn().mockResolvedValue(discovery) }
    render(<App research={next} history={createHistoryStore({ storage })} />)
    expect(await screen.findByRole("button", { name: /worst poet/ })).toBeVisible()
    expect(next.discover.mock.calls[0][1].requestId).toBe(requestId)
    expect(next.locate).not.toHaveBeenCalled()
    expect(createHistoryStore({ storage }).read().pendingDiscovery).toBeUndefined()
  })

  it("does not restore cleared history when a pending discovery finishes late", async () => {
    const user = userEvent.setup()
    const { fake, discovery, store, storage } = await setup()
    let finish!: (value: Discovery) => void
    const research = {
      ...fake,
      discover: vi.fn().mockImplementation(
        () =>
          new Promise<Discovery>(resolve => {
            finish = resolve
          }),
      ),
    }
    render(<App research={research} history={store} />)
    await waitFor(() => expect(research.discover).toHaveBeenCalledOnce())
    await user.click(screen.getByText("Saved reading", { exact: true }))
    await user.click(screen.getByRole("button", { name: "Clear history" }))
    await act(async () => finish(discovery))
    expect(screen.queryByRole("button", { name: /worst poet/ })).not.toBeInTheDocument()
    expect(createHistoryStore({ storage }).read().discoveries).toEqual([])
    expect(createHistoryStore({ storage }).read().pendingDiscovery).toBeUndefined()
  })
})
