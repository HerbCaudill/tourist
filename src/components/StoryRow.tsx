import { formatDistance } from "../lib/formatDistance"
import type { Story } from "../types"
import { KindTag } from "./KindTag"

/** One numbered entry in the nearby ledger. */
export function StoryRow(
  /** The story, its number, and what to do when tapped. */
  {
    story,
    number,
    onOpen,
  }: Props,
) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="flex w-full gap-2.5 border-t border-neutral-300 py-2 text-left active:bg-neutral-200"
    >
      <span className="w-10 shrink-0 text-right font-medium text-red-700">
        {formatDistance(story.distanceMeters).replace(" ", "")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between text-neutral-500">
          <span>
            <span className="text-red-700">{number}</span> {story.place.toLowerCase()}
          </span>
          <KindTag kind={story.kind} />
        </span>
        <span className="block font-semibold">{story.title}</span>
        <span className="block text-[12px] text-neutral-700">{story.preview}</span>
      </span>
    </button>
  )
}

type Props = {
  /** The story to show. */
  story: Story
  /** Its position in the list, from 1. */
  number: number
  /** Called when the row is tapped. */
  onOpen: () => void
}
