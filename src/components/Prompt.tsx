import { IconCircleArrowUpFilled } from "@tabler/icons-react"
import { useState } from "react"

/** A command-line style input for asking Tourist a question. */
export function Prompt(
  /** Placeholder text and submit handler. */
  {
    placeholder,
    onAsk,
    disabled = false,
  }: Props,
) {
  const [text, setText] = useState("")

  const submit = () => {
    const question = text.trim()
    if (!question || disabled) return
    onAsk(question)
    setText("")
  }

  return (
    <form
      className="flex shrink-0 items-center gap-1.5 border-t border-neutral-300 px-[18px] pt-2.5 pb-[max(1.5rem,env(safe-area-inset-bottom))]"
      onSubmit={e => {
        e.preventDefault()
        submit()
      }}
    >
      <span className="text-red-700">&gt;</span>
      {/* Keep a 16px input for iOS focus handling, scaled to the surrounding 12.5px text. */}
      <span className="relative h-[1.25em] min-w-0 flex-1">
        <input
          className="absolute top-0 left-0 w-[128%] origin-top-left scale-[0.78125] bg-transparent text-[16px] leading-tight outline-none placeholder:text-neutral-400/60"
          placeholder={placeholder}
          value={text}
          onChange={e => setText(e.target.value)}
          disabled={disabled}
          maxLength={2000}
          enterKeyHint="send"
          aria-label={placeholder}
        />
      </span>
      <button
        aria-label="Send question"
        type="submit"
        className="text-red-700"
        disabled={disabled || !text.trim()}
      >
        <IconCircleArrowUpFilled size={22} aria-hidden="true" />
      </button>
    </form>
  )
}

type Props = {
  /** Placeholder text for the input. */
  placeholder: string
  /** Called with the trimmed question when the user sends. */
  onAsk: (question: string) => void
  /** Whether sending is currently blocked. */
  disabled?: boolean
}
