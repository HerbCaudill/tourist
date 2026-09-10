// @vitest-environment node
import { describe, expect, it } from "vitest"
import { createHistoryStore } from "../createHistoryStore"
import type { Conversation, Discovery } from "../../types"

/** Give each store a private browser-like persistence boundary. */
function storage() {
  const values = new Map<string, string>()
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value)
    },
    removeItem: (key: string) => {
      values.delete(key)
    },
    values,
  }
}

const now = Date.parse("2026-09-09T13:00:00Z")
const discovery: Discovery = {
  location: {
    name: "Edinburgh",
    area: "",
    coordinates: { lat: 55.946, lon: -3.192 },
    accuracyMeters: 20,
  },
  stories: [
    {
      id: "story",
      placeId: "place",
      place: "Churchyard",
      title: "A sourced story",
      preview: "A preview",
      account: ["An independently sourced account."],
      sources: [{ name: "History", org: "Archive", url: "https://example.org/history" }],
      coordinates: { lat: 55.946, lon: -3.192 },
      distanceMeters: 0,
      bearing: "N",
      suggestedQuestions: ["What happened?"],
      timeSensitive: false,
    },
  ],
  researchedAt: new Date(now),
  radiusMeters: 200,
  mapProvider: "google",
  promptVersion: "ledger-4",
  coordinatesExpireAt: "2026-10-08T13:00:00Z",
}
const conversation: Conversation = {
  id: "conversation",
  context: {
    id: "conversation",
    originLocation: discovery.location,
    stories: discovery.stories,
    researchedAt: discovery.researchedAt.toISOString(),
    coordinatesExpireAt: discovery.coordinatesExpireAt,
    promptVersion: discovery.promptVersion,
  },
  messages: [
    { id: "question", role: "user", text: "What happened?" },
    {
      id: "answer",
      role: "tourist",
      text: "A sourced answer",
      sources: discovery.stories[0]!.sources,
    },
  ],
  updatedAt: new Date(now).toISOString(),
}

describe("local reading history", () => {
  it("reopens complete stories and sourced conversations with Date values restored", () => {
    const local = storage()
    const first = createHistoryStore({ storage: local, now: () => now })
    expect(first.saveDiscovery(discovery)).toBe(true)
    expect(first.saveConversation(conversation)).toBe(true)
    const reopened = createHistoryStore({ storage: local, now: () => now }).read()
    expect(reopened.discoveries[0]?.researchedAt).toBeInstanceOf(Date)
    expect(reopened.discoveries[0]?.stories[0]?.account).toEqual(discovery.stories[0]?.account)
    expect(reopened.conversations[0]?.messages[1]?.sources).toEqual(
      conversation.messages[1]?.sources,
    )
  })

  it("checks origin, radius, prompt version and age while keeping stale stories readable offline", () => {
    const local = storage()
    const store = createHistoryStore({ storage: local, now: () => now })
    store.saveDiscovery(discovery)
    expect(
      store.findSuitableDiscovery({
        location: discovery.location,
        radiusMeters: 200,
        promptVersion: "ledger-4",
      }),
    ).toBeDefined()
    expect(
      store.findSuitableDiscovery({
        location: discovery.location,
        radiusMeters: 500,
        promptVersion: "ledger-4",
      }),
    ).toBeUndefined()
    expect(
      store.findSuitableDiscovery({
        location: discovery.location,
        radiusMeters: 200,
        promptVersion: "future-version",
      }),
    ).toBeUndefined()
    expect(
      store.findSuitableDiscovery({
        location: { ...discovery.location, coordinates: { lat: 56, lon: -3 } },
        radiusMeters: 200,
        promptVersion: "ledger-4",
      }),
    ).toBeUndefined()
    const stale = createHistoryStore({ storage: local, now: () => now + 25 * 3_600_000 })
    expect(
      stale.findSuitableDiscovery({
        location: discovery.location,
        radiusMeters: 200,
        promptVersion: "ledger-4",
      }),
    ).toBeUndefined()
    expect(stale.read().discoveries).toHaveLength(1)
  })

  it("expires recent-event cache sooner and removes all geographic records at their provider deadline", () => {
    const local = storage()
    const store = createHistoryStore({ storage: local, now: () => now })
    store.saveDiscovery({
      ...discovery,
      stories: discovery.stories.map(story => ({ ...story, timeSensitive: true })),
    })
    store.saveConversation(conversation)
    const aged = createHistoryStore({ storage: local, now: () => now + 2 * 3_600_000 })
    expect(
      aged.findSuitableDiscovery({
        location: discovery.location,
        radiusMeters: 200,
        promptVersion: "ledger-4",
      }),
    ).toBeUndefined()
    const expired = createHistoryStore({
      storage: local,
      now: () => Date.parse(discovery.coordinatesExpireAt!) + 1,
    })
    expect(expired.read()).toEqual({ discoveries: [], conversations: [] })
    expect([...local.values.values()].join()).not.toContain("55.946")
  })

  it("handles corruption and denied storage gracefully, and clears its own saved history", () => {
    const local = storage()
    local.values.set("tourist.history.v1", "corrupt json")
    expect(createHistoryStore({ storage: local }).read()).toEqual({
      discoveries: [],
      conversations: [],
    })
    const store = createHistoryStore({ storage: local, now: () => now })
    store.saveDiscovery(discovery)
    expect(store.clear()).toBe(true)
    expect(createHistoryStore({ storage: local, now: () => now }).read().discoveries).toEqual([])
    const denied = createHistoryStore({
      storage: {
        getItem: () => {
          throw new Error("denied")
        },
        setItem: () => {
          throw new Error("quota")
        },
        removeItem: () => {},
      },
      now: () => now,
    })
    expect(denied.saveDiscovery(discovery)).toBe(false)
    expect(denied.read().discoveries[0]?.stories[0]?.title).toBe(discovery.stories[0]?.title)
  })
})

it("bounds history, saves independent copies, and excludes raw provider fields", () => {
  const local = storage()
  const store = createHistoryStore({ storage: local, now: () => now })
  for (let index = 0; index < 15; index++)
    store.saveDiscovery({
      ...discovery,
      researchedAt: new Date(now - index * 1000),
      rawCandidates: [{ name: "Private provider clue" }],
      mapImage: "data:image/png;base64,private",
    } as Discovery)
  expect(store.read().discoveries).toHaveLength(12)
  expect([...local.values.values()].join()).not.toMatch(
    /Private provider clue|mapImage|rawCandidates/,
  )
  const read = store.read()
  read.discoveries[0]!.stories[0]!.title = "Changed by caller"
  expect(store.read().discoveries[0]!.stories[0]!.title).toBe(discovery.stories[0]!.title)
})

it("rejects invalid timestamps gracefully instead of throwing or replacing valid history", () => {
  const store = createHistoryStore({ storage: storage(), now: () => now })
  store.saveDiscovery(discovery)
  expect(store.saveDiscovery({ ...discovery, researchedAt: new Date("invalid") })).toBe(false)
  expect(store.read().discoveries).toHaveLength(1)
})

it("retains the pending question for restart after its server job expires", () => {
  const local = storage()
  const store = createHistoryStore({ storage: local, now: () => now })
  const pending = {
    requestId: "13516742-4173-49c5-ae65-376e147c4dad",
    question: "What happened next?",
    location: discovery.location,
    originLocation: discovery.location,
    stories: discovery.stories,
    history: [],
  }
  store.saveConversation({ ...conversation, pending })
  const reopened = createHistoryStore({ storage: local, now: () => now + 25 * 3_600_000 }).read()
  expect(reopened.conversations[0]?.pending).toEqual(pending)
  expect(reopened.conversations[0]?.restartRequired).toBe(true)
})

it("keeps the previous browser archive if a later save hits quota", () => {
  const local = storage()
  const store = createHistoryStore({ storage: local, now: () => now })
  store.saveDiscovery(discovery)
  local.setItem = () => {
    throw new Error("quota")
  }
  const blocked = createHistoryStore({ storage: local, now: () => now })
  expect(blocked.saveConversation(conversation)).toBe(false)
  expect(createHistoryStore({ storage: local, now: () => now }).read().discoveries).toHaveLength(1)
})

it("reopens the same pending discovery without accumulating a location trail", () => {
  const local = storage()
  const store = createHistoryStore({ storage: local, now: () => now })
  const pending = {
    requestId: "13516742-4173-49c5-ae65-376e147c4dad",
    location: discovery.location,
    startedAt: new Date(now).toISOString(),
  }
  expect(store.savePendingDiscovery(pending)).toBe(true)
  expect(createHistoryStore({ storage: local, now: () => now }).read().pendingDiscovery).toEqual(
    pending,
  )
  const replacement = {
    ...pending,
    requestId: "a62b1dc9-37bf-4198-98ad-585c8a1b755d",
    location: { ...pending.location, name: "Another place" },
  }
  store.savePendingDiscovery(replacement)
  expect(createHistoryStore({ storage: local, now: () => now }).read().pendingDiscovery).toEqual(
    replacement,
  )
  expect([...local.values.values()].join()).not.toContain(pending.requestId)
  expect(store.clearPendingDiscovery()).toBe(true)
  expect(
    createHistoryStore({ storage: local, now: () => now }).read().pendingDiscovery,
  ).toBeUndefined()
})

it("expires pending discovery after a day, validates its fields, and clears it with reading history", () => {
  const local = storage()
  const store = createHistoryStore({ storage: local, now: () => now })
  const pending = {
    requestId: "13516742-4173-49c5-ae65-376e147c4dad",
    location: discovery.location,
    startedAt: new Date(now).toISOString(),
  }
  expect(store.savePendingDiscovery({ ...pending, requestId: "invalid" })).toBe(false)
  store.savePendingDiscovery(pending)
  expect(
    createHistoryStore({ storage: local, now: () => now + 24 * 3_600_000 }).read().pendingDiscovery,
  ).toBeUndefined()
  expect([...local.values.values()].join()).not.toContain(pending.requestId)
  store.savePendingDiscovery(pending)
  store.clear()
  expect(
    createHistoryStore({ storage: local, now: () => now }).read().pendingDiscovery,
  ).toBeUndefined()
})
