import { ChatTranscript } from "./ChatTranscript"
import type { Message, Story } from "../types"
import { BackButton } from "./BackButton"
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
        <ChatTranscript
          messages={messages}
          answering={answering}
          offline={offline}
          questionDisabled={questionDisabled}
          error={error}
          onRetry={onRetry}
          onRestart={onRestart}
          restartRequired={restartRequired}
          suggestions={suggestions}
          onAsk={onAsk}
        />
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
