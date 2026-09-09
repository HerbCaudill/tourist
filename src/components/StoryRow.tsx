import { formatDistance } from "../lib/formatDistance"
import type { Story } from "../types"
import { IconArrowNarrowRightDashed } from "@tabler/icons-react"

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
      className="flex w-full items-baseline gap-2.5 border-t border-neutral-300 py-2 text-left first:border-t-0 active:bg-neutral-200"
    >
      <span className="w-10 shrink-0 text-right font-medium text-red-700">
        {formatDistance(story.distanceMeters).replace(" ", "")}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex justify-between gap-2 text-neutral-500">
          <span className="flex items-baseline gap-1.5 text-[11px] leading-tight">
            <span className="inline-flex size-[18px] shrink-0 items-center justify-center rounded-full bg-red-700 text-[10px] font-medium text-white">
              {number}
            </span>
            <span>{story.place.toLowerCase()}</span>
          </span>
          <IconArrowNarrowRightDashed
            size={18}
            stroke={1.5}
            className="shrink-0"
            aria-hidden="true"
          />
        </span>
        <span className="block font-semibold">{story.title}</span>
        <span className="block text-[11px] text-neutral-700">{story.preview}</span>
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
