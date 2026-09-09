import { act, render, renderHook, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"
import { useDiscovery } from "../hooks/useDiscovery"
import { App } from "../App"
import { createFakeResearch } from "../lib/createFakeResearch"
import { createHistoryStore } from "../lib/createHistoryStore"
import { ResearchClientError } from "../lib/ResearchClientError"
import { location } from "../data/location"
import type { Discovery } from "../types"

afterEach(() => vi.restoreAllMocks())

it("does not restore an invalid research job after reopening", async () => {
  const { fake, discovery, store } = await setup()
  const research = {
    ...fake,
    discover: vi.fn().mockRejectedValue(new ResearchClientError("malformed", "Invalid result")),
  }
  const first = renderHook(() => useDiscovery(research, store))
  await waitFor(() => expect(first.result.current.error).toBe("Invalid result"))
  const failedId = research.discover.mock.calls[0][1].requestId
  expect(store.read().pendingDiscovery).toBeUndefined()
  first.unmount()
  const next = { ...fake, discover: vi.fn().mockResolvedValue(discovery) }
  const reopened = renderHook(() => useDiscovery(next, store))
  await waitFor(() => expect(reopened.result.current.discovery).toBeDefined())
  expect(next.discover.mock.calls[0][1].requestId).not.toBe(failedId)
})

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
    promptVersion: "ledger-2",
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
  it("reopens an index conversation below saved stories after an offline reload", async () => {
    const user = userEvent.setup()
    const { fake, discovery, store, storage } = await setup()
    store.saveDiscovery(discovery)
    const research = {
      ...fake,
      ask: vi.fn().mockResolvedValue({ text: "A saved location answer.", sources: [] }),
    }
    const mounted = render(<App research={research} history={store} />)
    await waitFor(() => expect(screen.getByPlaceholderText("Ask me anything")).toBeEnabled())
    await user.type(
      screen.getByPlaceholderText("Ask me anything"),
      "Tell me about this area{enter}",
    )
    expect(await screen.findByText("A saved location answer.")).toBeVisible()
    expect(window.location.pathname).toBe("/")
    mounted.unmount()
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    const restored = render(<App research={research} history={createHistoryStore({ storage })} />)
    expect(screen.getByRole("button", { name: /worst poet/ })).toBeVisible()
    expect(screen.getByText("A saved location answer.")).toBeVisible()
    expect(screen.getByPlaceholderText("Ask me anything")).toBeDisabled()
    restored.unmount()
    const context = store.read().conversations[0].context
    window.history.replaceState(
      null,
      "",
      `/chats/${encodeURIComponent(context.researchedAt)}/general`,
    )
    render(<App research={research} history={createHistoryStore({ storage })} />)
    expect(screen.getByRole("button", { name: /worst poet/ })).toBeVisible()
    expect(screen.getByText("A saved location answer.")).toBeVisible()
  })

  it("reopens full stories offline", async () => {
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
    const storyPath = window.location.pathname
    expect(storyPath).toMatch(/^\/stories\//)
    unmount()
    render(<App research={research} history={createHistoryStore({ storage })} />)
    expect(screen.getByText(/Dundee handloom weaver/)).toBeVisible()
    expect(window.location.pathname).toBe(storyPath)
    expect(createHistoryStore({ storage }).read().discoveries).toHaveLength(1)
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

  it.each([false, true])("restores pending location mode (manual: %s)", async manual => {
    const { fake, discovery, store, storage } = await setup()
    const first = {
      ...fake,
      discover: vi.fn().mockImplementation(() => new Promise<Discovery>(() => {})),
    }
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(false)
    const original = renderHook(() => useDiscovery(first, store))
    vi.spyOn(navigator, "onLine", "get").mockReturnValue(true)
    await act(async () => {
      void original.result.current.choosePlace(manual ? "Dundee" : undefined)
    })
    await waitFor(() => expect(first.discover).toHaveBeenCalledOnce())
    original.unmount()
    const next = {
      ...fake,
      locate: vi.fn().mockResolvedValue(location),
      discover: vi.fn().mockResolvedValue(discovery),
    }
    const archive = createHistoryStore({ storage })
    const restored = renderHook(() => useDiscovery(next, archive))
    await waitFor(() => expect(restored.result.current.busy).toBe(false))
    await act(async () => document.dispatchEvent(new Event("visibilitychange")))
    expect(next.locate).toHaveBeenCalledTimes(manual ? 0 : 1)
    restored.unmount()
  })

  it.each([false, true])(
    "abandons failed discovery on cache selection while preserving storage errors (%s)",
    async storageFails => {
      const { fake, discovery, store } = await setup()
      store.saveDiscovery(discovery)
      if (storageFails) {
        const save = store.savePendingDiscovery
        vi.spyOn(store, "savePendingDiscovery").mockImplementation(request => {
          save(request)
          return false
        })
      }
      const elsewhere = { ...location, coordinates: { lat: 41, lon: 2 } }
      const research = {
        ...fake,
        locate: vi.fn().mockResolvedValue(elsewhere),
        resolveLocation: vi.fn().mockResolvedValue(location),
        discover: vi.fn().mockRejectedValue(new Error("Disconnected")),
      }
      const hook = renderHook(() => useDiscovery(research, store))
      await waitFor(() => expect(hook.result.current.error).toBe("Disconnected"))
      await act(async () => hook.result.current.choosePlace("Dundee"))
      expect(store.read().pendingDiscovery).toBeUndefined()
      expect(hook.result.current.error).toBeUndefined()
      expect(hook.result.current.storageError).toBe(storageFails)
      await act(async () => document.dispatchEvent(new Event("visibilitychange")))
      expect(research.discover).toHaveBeenCalledOnce()
    },
  )

  it("does not restore cleared history when a pending discovery finishes late", async () => {
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
    const { result } = renderHook(() => useDiscovery(research, store))
    await waitFor(() => expect(research.discover).toHaveBeenCalledOnce())
    await act(async () => {
      result.current.clear()
      store.clear()
    })
    await act(async () => finish(discovery))
    expect(result.current.discovery).toBeUndefined()
    expect(createHistoryStore({ storage }).read().discoveries).toEqual([])
    expect(createHistoryStore({ storage }).read().pendingDiscovery).toBeUndefined()
  })
})
