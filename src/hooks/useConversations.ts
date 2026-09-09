import { ResearchClientError } from "../lib/ResearchClientError"
import { useEffect, useRef, useState } from "react"
import type { ChatRequest, Conversation, ConversationContext, Location, Research } from "../types"

/** Keep each pending answer and retry attached to its original conversation. */
export function useConversations(
  /** Current fixture or live transport. */
  research: Research,
) {
  const [conversations, setConversations] = useState<Record<string, Conversation>>({})
  const records = useRef<Record<string, Conversation>>({})
  const running = useRef(new Map<string, AbortController>())

  useEffect(
    () => () => {
      for (const controller of running.current.values()) controller.abort()
      running.current.clear()
    },
    [],
  )

  /** Publish a synchronous transcript update so repeated taps see the latest state. */
  const save = (conversation: Conversation) => {
    records.current = { ...records.current, [conversation.id]: conversation }
    setConversations(records.current)
  }

  /** Deliver an exact persisted request once, updating only its originating transcript. */
  const send = async (id: string, request: ChatRequest) => {
    if (running.current.has(id)) return
    const controller = new AbortController()
    running.current.set(id, controller)
    save({
      ...records.current[id],
      pending: request,
      error: undefined,
      restartRequired: undefined,
      updatedAt: new Date().toISOString(),
    })
    try {
      const answer = await research.ask(request, {
        requestId: request.requestId,
        signal: controller.signal,
      })
      if (controller.signal.aborted) return
      const current = records.current[id]
      save({
        ...current,
        pending: undefined,
        messages: [
          ...current.messages,
          {
            id: crypto.randomUUID(),
            role: "tourist",
            text: answer.text,
            source: answer.source,
            sources: answer.sources,
          },
        ],
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      if (controller.signal.aborted) return
      save({
        ...records.current[id],
        restartRequired: error instanceof ResearchClientError && error.restartRequired,
        error:
          error instanceof Error
            ? error.message
            : "The answer could not be retrieved. Retry to reconnect.",
        updatedAt: new Date().toISOString(),
      })
    } finally {
      running.current.delete(id)
    }
  }

  /** Append a user turn and send bounded history with both active and original locations. */
  const ask = (context: ConversationContext, question: string, location: Location) => {
    const current = records.current[context.id]
    if (
      running.current.has(context.id) ||
      current?.pending ||
      !question.trim() ||
      question.length > 2000
    )
      return
    const request: ChatRequest = {
      requestId: crypto.randomUUID(),
      question: question.trim(),
      location,
      originLocation: context.originLocation,
      stories: context.stories,
      history: (current?.messages ?? [])
        .slice(-12)
        .map(({ role, text }) => ({ role, text: text.slice(0, 6000) })),
      ...(context.selectedStoryId ? { selectedStoryId: context.selectedStoryId } : {}),
    }
    save({
      id: context.id,
      context,
      messages: [
        ...(current?.messages ?? []),
        { id: crypto.randomUUID(), role: "user", text: request.question },
      ],
      updatedAt: new Date().toISOString(),
    })
    void send(context.id, request)
  }

  /** Reuse the failed request without appending another copy of its question. */
  const retry = (id: string, restart = false) => {
    const current = records.current[id]
    const request = current?.pending
    if (request)
      void send(
        id,
        restart || current.restartRequired
          ? { ...request, requestId: crypto.randomUUID() }
          : request,
      )
  }

  return { conversations, ask, retry }
}
