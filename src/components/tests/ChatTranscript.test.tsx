import { act, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ChatTranscript } from "../ChatTranscript"

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

it("shows the animated braille spinner while waiting for an answer", () => {
  vi.useFakeTimers()
  render(
    <ChatTranscript
      messages={[]}
      answering
      suggestions={[]}
      onAsk={vi.fn()}
      onRetry={vi.fn()}
      onRestart={vi.fn()}
    />,
  )
  expect(screen.getByText("⠋")).toBeVisible()
  act(() => vi.advanceTimersByTime(80))
  expect(screen.getByText("⠙")).toBeVisible()
})

it("keeps the waiting spinner still when reduced motion is preferred", () => {
  vi.useFakeTimers()
  vi.stubGlobal("matchMedia", () => ({
    matches: true,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
  render(
    <ChatTranscript
      messages={[]}
      answering
      suggestions={[]}
      onAsk={vi.fn()}
      onRetry={vi.fn()}
      onRestart={vi.fn()}
    />,
  )
  expect(screen.getByText("⠿")).toBeVisible()
  act(() => vi.advanceTimersByTime(800))
  expect(screen.getByText("⠿")).toBeVisible()
})
