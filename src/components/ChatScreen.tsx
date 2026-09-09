import { useEffect, useRef } from "react"
import type { Message, Story } from "../types"
import { BackButton } from "./BackButton"
import { Cursor } from "./Cursor"
import { HeaderLine } from "./HeaderLine"
import { Prompt } from "./Prompt"

/** A transcript of questions and answers, about a story or the current location. */
export function ChatScreen(
  /** Conversation state and handlers. */
  {
    story,
    number,
    contextLabel,
    messages,
    answering,
    offline,
    questionDisabled,
    error,
    onRetry,
    onRestart,
    restartRequired,
    suggestions,
    onBack,
    onAsk,
  }: Props,
) {
  const bottom = useRef<HTMLDivElement>(null)
  useEffect(() => {
    bottom.current?.scrollIntoView?.({ block: "end" })
  }, [messages.length, answering])

  return (
    <>
      <HeaderLine
        left={<BackButton label={story ? "story" : "nearby"} onClick={onBack} />}
        right={
          <>
            ctx: {story && number ? `#${number} ` : ""}
            {contextLabel.toLowerCase()}
          </>
        }
      />
      <div className="flex-1 overflow-y-auto px-[18px] pt-2 pb-3">
        {messages.map(message => (
          <div key={message.id} className="mb-3 flex gap-2">
            <span
              className={
                message.role === "user"
                  ? "w-11 shrink-0 font-semibold text-red-700"
                  : "w-11 shrink-0 font-semibold text-neutral-500"
              }
            >
              {message.role === "user" ? "you>" : "tour>"}
            </span>
            <span className="min-w-0 flex-1 text-neutral-800">
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
                      <span className="text-red-700">[{index + 1}]</span> {source.name} ·{" "}
                      {source.org}
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
            <span className="w-11 shrink-0 font-semibold text-neutral-500">tour&gt;</span>
            <Cursor />
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
                className="block w-full text-left text-neutral-800 hover:text-red-700"
              >
                <span className="text-neutral-500">?</span> {q.toLowerCase()}
              </button>
            ))}
          </div>
        )}
        <div ref={bottom} />
      </div>
      <Prompt
        placeholder="ask a follow-up"
        onAsk={onAsk}
        disabled={offline || questionDisabled || answering || !!error}
      />
    </>
  )
}

type Props = {
  /** The story the chat is about, if any. */
  story?: Story
  /** The story's number in the nearby list, if any. */
  number?: number
  /** Short description of the context shown in the header. */
  contextLabel: string
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
  /** Return to the previous screen. */
  onBack: () => void
  /** Send a question. */
  onAsk: (question: string) => void
}
