import { act, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import { App } from "../App"
import { createFakeResearch } from "../lib/createFakeResearch"
import { location } from "../data/location"
import { ResearchClientError } from "../lib/ResearchClientError"
import type { Answer } from "../types"

describe("contextual chat", () => {
  it("sends story context and prior turns, and renders linked answer sources", async () => {
    const user = userEvent.setup()
    const research = {
      ...createFakeResearch({ delayMs: 0 }),
      ask: vi.fn().mockResolvedValue({
        text: "First answer",
        sources: [{ name: "Archive record", org: "Archive", url: "https://example.com/archive" }],
      }),
    }
    render(<App research={research} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "Who was he?{enter}")
    expect(await screen.findByRole("link", { name: /Archive record/ })).toHaveAttribute(
      "href",
      "https://example.com/archive",
    )
    expect(research.ask.mock.calls[0][0]).toMatchObject({
      question: "Who was he?",
      location,
      originLocation: location,
      selectedStoryId: "mcgonagall",
      history: [],
    })
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "What happened next?{enter}")
    await waitFor(() => expect(research.ask).toHaveBeenCalledTimes(2))
    expect(research.ask.mock.calls[1][0].history).toEqual([
      { role: "user", text: "Who was he?" },
      { role: "tourist", text: "First answer" },
    ])
  })

  it("retries the failed question with one user turn and the same request ID", async () => {
    const user = userEvent.setup()
    const research = {
      ...createFakeResearch({ delayMs: 0 }),
      ask: vi
        .fn()
        .mockRejectedValueOnce(new Error("Connection interrupted"))
        .mockResolvedValue({ text: "Recovered answer", sources: [] }),
    }
    render(<App research={research} />)
    await screen.findByRole("button", { name: /worst poet/ })
    await user.type(
      screen.getByPlaceholderText("ask about this place"),
      "What happened here?{enter}",
    )
    expect(await screen.findByRole("alert")).toHaveTextContent("Connection interrupted")
    await user.click(screen.getByRole("button", { name: "Retry answer" }))
    expect(await screen.findByText("Recovered answer")).toBeVisible()
    expect(screen.getAllByText("What happened here?")).toHaveLength(1)
    expect(research.ask.mock.calls[1][0]).toEqual(research.ask.mock.calls[0][0])
  })

  it("keeps a delayed answer in its original conversation after switching stories", async () => {
    const user = userEvent.setup()
    let finish!: (value: Answer) => void
    const research = {
      ...createFakeResearch({ delayMs: 0 }),
      ask: vi
        .fn()
        .mockImplementationOnce(
          () =>
            new Promise<Answer>(resolve => {
              finish = resolve
            }),
        )
        .mockResolvedValue({ text: "Bobby answer", sources: [] }),
    }
    render(<App research={research} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "Poet question{enter}")
    await user.click(screen.getByRole("button", { name: /story/ }))
    await user.click(screen.getByRole("button", { name: /back/ }))
    await user.click(screen.getByRole("button", { name: /Bobby/ }))
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "Dog question{enter}")
    expect(await screen.findByText("Bobby answer")).toBeVisible()
    await act(async () => finish({ text: "Poet answer", sources: [] }))
    expect(screen.queryByText("Poet answer")).not.toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: /story/ }))
    await user.click(screen.getByRole("button", { name: /back/ }))
    await user.click(screen.getByRole("button", { name: /worst poet/ }))
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "Another poet question{enter}")
    expect(screen.getByText("Poet answer")).toBeVisible()
  })
  it("keeps the originating story location after movement while sending the active location", async () => {
    const user = userEvent.setup()
    let finish!: (value: Answer) => void
    const original = {
      ...createFakeResearch({ delayMs: 0 }),
      ask: vi.fn().mockImplementation(
        () =>
          new Promise<Answer>(resolve => {
            finish = resolve
          }),
      ),
    }
    const { rerender } = render(<App research={original} />)
    await user.click(await screen.findByRole("button", { name: /worst poet/ }))
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "Tell me more{enter}")
    const moved = {
      ...location,
      name: "Castle Esplanade",
      coordinates: { lat: 55.9486, lon: -3.1984 },
    }
    const replacement = {
      ...createFakeResearch({ delayMs: 0 }),
      locate: vi.fn().mockResolvedValue(moved),
      ask: vi.fn().mockResolvedValue({ text: "Answer after moving", sources: [] }),
    }
    rerender(<App research={replacement} />)
    await act(async () => finish({ text: "Original answer", sources: [] }))
    await user.type(screen.getByPlaceholderText("ask a follow-up"), "And now?{enter}")
    await waitFor(() => expect(replacement.ask).toHaveBeenCalledOnce())
    expect(replacement.ask.mock.calls[0][0]).toMatchObject({
      location: moved,
      originLocation: location,
      selectedStoryId: "mcgonagall",
    })
    expect(screen.getByText(/greyfriars kirkyard/)).toBeVisible()
  })
  it("starts a fresh job for an expired answer without adding another user turn", async () => {
    const user = userEvent.setup()
    const research = {
      ...createFakeResearch({ delayMs: 0 }),
      ask: vi
        .fn()
        .mockRejectedValueOnce(new ResearchClientError("expired", "This research has expired."))
        .mockResolvedValue({ text: "Fresh answer", sources: [] }),
    }
    render(<App research={research} />)
    await screen.findByRole("button", { name: /worst poet/ })
    await user.type(
      screen.getByPlaceholderText("ask about this place"),
      "What happened here?{enter}",
    )
    await screen.findByRole("alert")
    await user.click(screen.getByRole("button", { name: "Retry answer" }))
    expect(await screen.findByText("Fresh answer")).toBeVisible()
    expect(screen.getAllByText("What happened here?")).toHaveLength(1)
    expect(research.ask.mock.calls[1][0].requestId).not.toBe(
      research.ask.mock.calls[0][0].requestId,
    )
    expect(research.ask.mock.calls[1][0].question).toBe(research.ask.mock.calls[0][0].question)
  })
})
