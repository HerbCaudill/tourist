import { cn } from "cn"
import { formatDistance } from "../lib/formatDistance"
import type { Discovery, Location } from "../types"
import { Cursor } from "./Cursor"
import { HeaderLine } from "./HeaderLine"
import { MiniMap } from "./MiniMap"
import { Prompt } from "./Prompt"
import { StoryRow } from "./StoryRow"

/** The main ledger: location line, a little map, and numbered story rows. */
export function NearbyScreen(
  /** Current discovery state and handlers. */
  {
    discovery,
    location,
    radiusMeters,
    researching,
    onRefresh,
    onOpenStory,
    onAsk,
  }: Props,
) {
  const stories = discovery?.stories ?? []
  const updated = discovery?.researchedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return (
    <>
      <HeaderLine
        left={
          <>
            <b>tourist</b> <span className="text-neutral-500">@</span>{" "}
            {location ? location.name.toLowerCase() : "locating…"}
          </>
        }
        right={
          <>
            {location && `±${location.accuracyMeters}m `}
            {updated && `${updated} `}
            <button
              type="button"
              aria-label="Refresh"
              onClick={onRefresh}
              disabled={researching || !location}
              className={cn("text-red-700", researching && "animate-pulse")}
            >
              [r]
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-[18px] pb-2">
        {location && (
          <div className="my-2.5">
            <MiniMap
              you={location.coordinates}
              markers={stories.map((s, i) => ({
                label: String(i + 1),
                coordinates: s.coordinates,
              }))}
              radiusMeters={radiusMeters}
            />
          </div>
        )}
        {researching && stories.length === 0 && (
          <p className="py-1 text-neutral-500">
            researching within {formatDistance(radiusMeters).replace(" ", "")} <Cursor />
          </p>
        )}
        {!researching && discovery && stories.length === 0 && (
          <p className="py-1 text-neutral-500">nothing worth telling within 200m. try [r] later.</p>
        )}
        <div className={cn(researching && stories.length > 0 && "opacity-60")}>
          {stories.map((story, i) => (
            <StoryRow
              key={story.id}
              story={story}
              number={i + 1}
              onOpen={() => onOpenStory(story.id)}
            />
          ))}
        </div>
      </div>

      <Prompt placeholder="ask about this place" onAsk={onAsk} />
    </>
  )
}

type Props = {
  /** The latest completed research, if any. */
  discovery?: Discovery
  /** The active location, if known. */
  location?: Location
  /** Search radius currently in use. */
  radiusMeters: number
  /** Whether research is currently running. */
  researching: boolean
  /** Run discovery again. */
  onRefresh: () => void
  /** Open a story by id. */
  onOpenStory: (id: string) => void
  /** Start a general chat with this question. */
  onAsk: (question: string) => void
}
