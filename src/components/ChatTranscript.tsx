import { IconMessageCircle } from "@tabler/icons-react"
import { useEffect, useRef } from "react"
import { cn } from "cn"
import type { Message } from "../types"
import { BrailleSpinner } from "./BrailleSpinner"

/** Questions, answers, and retry controls shared by inline and location conversations. */
export function ChatTranscript(
  /** Conversation state and actions. */
  {
    messages,
    answering,
    offline,
    questionDisabled,
    error,
    onRetry,
    onRestart,
    restartRequired,
    suggestions,
    onAsk,
  }: Props,
) {
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (messages.length > 0) bottom.current?.scrollIntoView?.({ block: "end" })
  }, [messages.length, answering, error])
  return (
    <section aria-label="Conversation" className="mt-4">
      {messages.map(message => (
        <div
          key={message.id}
          className={cn(
            "mb-4 text-neutral-800",
            message.role === "user"
              ? "ml-auto w-fit max-w-[80%] rounded-2xl bg-neutral-200 px-3 py-2"
              : "w-full",
          )}
          aria-label={message.role === "user" ? "Your message" : "Tourist response"}
        >
          <span className="block break-words whitespace-pre-wrap">
            {message.text}
            {message.sources && message.sources.length > 0 && (
              <span className="mt-1.5 block text-[12px] text-neutral-500">
                {message.sources.map((source, index) => (
                  <a
                    key={`${source.url}/${index}`}
                    href={source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="mb-1 block underline decoration-neutral-400 underline-offset-2"
                  >
                    <span className="text-red-700">[{index + 1}]</span> {source.name} · {source.org}
                  </a>
                ))}
              </span>
            )}
            {message.source && (
              <span className="mt-1.5 block text-[12px] text-neutral-500">
                <span className="text-red-700">[src]</span> {message.source.toLowerCase()}
              </span>
            )}
          </span>
        </div>
      ))}
      {answering && (
        <div className="mb-3 flex gap-2">
          <BrailleSpinner />
        </div>
      )}
      {error && (
        <div role="alert" className="mb-3 text-red-700">
          <p>{error}</p>
          <button type="button" onClick={onRetry} disabled={offline} className="mt-1 underline">
            Retry answer
          </button>
          {!restartRequired && (
            <button
              type="button"
              onClick={onRestart}
              disabled={offline}
              className="mt-1 ml-3 underline"
            >
              Start answer again
            </button>
          )}
        </div>
      )}
      {!offline && !questionDisabled && !answering && !error && suggestions.length > 0 && (
        <div className="border-t border-neutral-300 pt-2">
          {suggestions.map(q => (
            <button
              key={q}
              type="button"
              onClick={() => onAsk(q)}
              className="flex w-full items-start gap-1.5 text-left text-neutral-800 hover:text-red-700"
            >
              <IconMessageCircle
                size={14}
                stroke={1.5}
                className="mt-px shrink-0 text-neutral-500"
                aria-hidden="true"
              />
              <span className="italic">{q.toLowerCase()}</span>
            </button>
          ))}
        </div>
      )}
      <div ref={bottom} />
    </section>
  )
}

type Props = {
  /** The conversation so far. */
  messages: Message[]
  /** Whether a reply is pending. */
  answering: boolean
  /** Whether new requests are unavailable while offline. */
  offline?: boolean
  /** A new question needs a current location; retry can use its original request. */
  questionDisabled?: boolean
  /** Recoverable failure for this conversation only. */
  error?: string
  /** Resend the exact failed request without duplicating the user turn. */
  onRetry: () => void
  /** Explicitly start a fresh job when reconnection cannot recover it. */
  onRestart: () => void
  /** Whether the retry already starts a fresh job. */
  restartRequired?: boolean
  /** Questions the user can tap to ask. */
  suggestions: string[]
  /** Send a question. */
  onAsk: (question: string) => void
}
