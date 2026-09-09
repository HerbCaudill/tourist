import { formatDistance } from "../lib/formatDistance"
import type { Location, Story } from "../types"
import { BackButton } from "./BackButton"
import { Footnotes } from "./Footnotes"
import { HeaderLine } from "./HeaderLine"
import { KindTag } from "./KindTag"
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
  }: Props,
) {
  return (
    <>
      <HeaderLine
        left={<BackButton label="back" onClick={onBack} />}
        right={
          <>
            #{number} {formatDistance(story.distanceMeters).replace(" ", "")} {story.bearing}{" "}
            <KindTag kind={story.kind} />
          </>
        }
      />
      <article className="flex-1 overflow-y-auto px-[18px] pt-2 pb-3">
        <p className="text-neutral-500">{story.place.toLowerCase()}</p>
        {origin && (
          <p className="mt-1 text-[11px] text-neutral-500">
            Distance from {origin.name.toLowerCase()}
          </p>
        )}
        <h1 className="mt-1 mb-3 text-[14px] font-semibold">{story.title}</h1>
        {story.account.map((paragraph, i) => (
          <p key={i} className="mb-2.5 text-neutral-800">
            {paragraph}{" "}
            <span className="text-red-700">[{Math.min(i + 1, story.sources.length)}]</span>
          </p>
        ))}
        <Footnotes sources={story.sources} />
      </article>
      <Prompt placeholder="ask a follow-up" onAsk={onAsk} />
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
}
