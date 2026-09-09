import type { ReactNode } from "react"
import { WalkingMap } from "./WalkingMap"
import { formatDistance } from "../lib/formatDistance"
import type { Location, Story } from "../types"
import { BackButton } from "./BackButton"
import { Footnotes } from "./Footnotes"
import { HeaderLine } from "./HeaderLine"
import { Prompt } from "./Prompt"

/** A story's full account with numbered footnotes. */
export function StoryScreen(
  /** The story, its number, and handlers. */
  {
    story,
    number,
    origin,
    onBack,
    onAsk,
    chatPending,
    conversation,
  }: Props,
) {
  return (
    <>
      <HeaderLine
        left={<BackButton label="back" onClick={onBack} />}
        right={
          <>
            #{number} {formatDistance(story.distanceMeters).replace(" ", "")} {story.bearing}
          </>
        }
      />
      <div className="shrink-0 px-[18px] pt-2">
        <p className="text-neutral-500">{story.place.toLowerCase()}</p>
        <h1 className="mt-1 mb-3 text-[14px] font-semibold">{story.title}</h1>
        <WalkingMap
          number={number}
          origin={origin?.coordinates}
          destination={story.coordinates}
          place={story.place}
        />
      </div>
      <article
        aria-label="Story and conversation"
        className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-3"
      >
        {story.account.map((paragraph, i) => (
          <p key={i} className="mb-2.5 text-neutral-800">
            {paragraph}
          </p>
        ))}
        <Footnotes sources={story.sources} />
        {conversation}
      </article>
      <Prompt placeholder="ask a follow-up" onAsk={onAsk} disabled={chatPending} />
    </>
  )
}

type Props = {
  /** The story to read. */
  story: Story
  /** Its position in the nearby list, from 1. */
  number: number
  /** Location used when this story was discovered. */
  origin?: Location
  /** Return to the nearby list. */
  onBack: () => void
  /** Start a follow-up chat with this question. */
  onAsk: (question: string) => void
  /** Prevent a second question from being lost while the previous answer waits. */
  chatPending?: boolean
  /** Follow-up conversation rendered after the story and its sources. */
  conversation: ReactNode
}
