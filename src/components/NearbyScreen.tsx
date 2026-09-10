import { IconRefresh } from "@tabler/icons-react"
import { useState, type ReactNode } from "react"
import { cn } from "cn"
import { formatDistance } from "../lib/formatDistance"
import type { Discovery, Location, ResearchProgress } from "../types"
import { ResearchFeed } from "./ResearchFeed"
import { GoogleMap } from "./GoogleMap"
import { HeaderLine } from "./HeaderLine"
import { MiniMap } from "./MiniMap"
import { Prompt } from "./Prompt"
import { StoryRow } from "./StoryRow"
import { LocationPicker } from "./LocationPicker"

/** The main ledger: location line, a little map, and numbered story rows. */
export function NearbyScreen(
  /** Current discovery state and handlers. */
  {
    discovery,
    location,
    deviceLocation,
    radiusMeters,
    researching,
    offline,
    mapProvider,
    progress,
    error,
    onRefresh,
    onRetry,
    onChoosePlace,
    locate,
    resolveLocation,
    onOpenStory,
    onAsk,
    chatPending,
    conversation,
    savedReading,
  }: Props,
) {
  const [choosing, setChoosing] = useState(false)
  const [searchContainer, setSearchContainer] = useState<HTMLDivElement | null>(null)
  const stories = researching ? [] : (discovery?.stories ?? [])
  const origin = researching ? location : (discovery?.location ?? location)

  return (
    <>
      <HeaderLine
        allowOverflow
        left={
          <div className="flex min-w-0 items-center gap-1.5">
            <b>tourist</b>
            <span className="text-neutral-500">@</span>
            <div ref={setSearchContainer} className="relative min-w-0 flex-1" />
          </div>
        }
        right={
          <button
            type="button"
            aria-label="Refresh"
            onClick={onRefresh}
            disabled={researching || offline}
            className={cn("text-red-700", researching && "motion-safe:animate-spin")}
          >
            <IconRefresh size={16} stroke={1.5} aria-hidden="true" />
          </button>
        }
      />

      <div className="shrink-0 px-[18px]">
        {error && !choosing && (
          <div role="alert" className="my-2 text-red-700">
            <p>{error}</p>
            <button
              type="button"
              onClick={onRetry}
              disabled={researching || offline}
              className="mt-1 underline"
            >
              Try again
            </button>
          </div>
        )}
        <div className="-mx-[18px] my-2.5">
          <LocationPicker
            initial={origin}
            searchContainer={searchContainer}
            onEditingChange={setChoosing}
            deviceLocation={deviceLocation}
            locate={locate}
            resolveLocation={resolveLocation}
            offline={offline}
            onConfirm={onChoosePlace}
          >
            {origin && (
              <div>
                {(discovery?.mapProvider ?? mapProvider) === "google" ? (
                  <GoogleMap
                    location={origin}
                    stories={stories}
                    radiusMeters={radiusMeters}
                    researching={researching}
                  />
                ) : (
                  <MiniMap
                    researching={researching}
                    you={origin.coordinates}
                    markers={stories.map((story, index) => ({
                      label: String(index + 1),
                      coordinates: story.coordinates,
                    }))}
                    radiusMeters={radiusMeters}
                  />
                )}
              </div>
            )}
          </LocationPicker>
        </div>
      </div>
      <div
        aria-label="Stories and conversation"
        className="min-h-0 flex-1 overflow-y-auto px-[18px] pb-2"
      >
        {researching && (
          <ResearchFeed
            key={`${location?.coordinates.lat}/${location?.coordinates.lon}/${progress?.radiusMeters ?? 200}`}
            location={progress ? location : undefined}
            progress={progress}
          />
        )}
        {!researching && discovery && stories.length === 0 && (
          <p className="py-1 text-neutral-500">
            Nothing worth telling within {formatDistance(radiusMeters)}. Try refreshing later.
          </p>
        )}
        <div>
          {stories.map((story, index) => (
            <StoryRow
              key={story.id}
              story={story}
              number={index + 1}
              onOpen={() => onOpenStory(story.id)}
            />
          ))}
        </div>
        {offline && !discovery && (
          <p className="py-2 text-neutral-500">No saved stories on this device.</p>
        )}
        {conversation}
        <div hidden>{savedReading}</div>
      </div>
      <Prompt placeholder="Ask me anything" onAsk={onAsk} disabled={!location || chatPending} />
    </>
  )
}

type Props = {
  /** Latest completed research. */
  discovery?: Discovery
  /** Current chosen or browser location. */
  location?: Location
  /** Last known device position, distinct from an alternate exploration origin. */
  deviceLocation?: Location
  /** Radius belonging to the displayed results. */
  radiusMeters: number
  /** Whether location or research is pending. */
  researching: boolean
  /** Saved reading stays available while new requests are disabled. */
  offline?: boolean
  /** Maps provider required by the active research adapter. */
  mapProvider?: "google"
  /** Server progress, when research has started. */
  progress?: ResearchProgress
  /** Recoverable user-facing failure. */
  error?: string
  /** Whether to open the typed location fallback. */
  locationError: boolean
  /** Start fresh discovery. */
  onRefresh: () => void
  /** Reconnect or retry location. */
  onRetry: () => void
  /** Search around a confirmed map or search position. */
  onChoosePlace: (location: Location) => void
  /** Preview a fresh device position. */
  locate: () => Promise<Location>
  /** Resolve a typed place if autocomplete is unavailable. */
  resolveLocation: (query: string) => Promise<Location>
  /** Open a story snapshot. */
  onOpenStory: (id: string) => void
  /** Start general chat. */
  onAsk: (question: string) => void
  /** Whether the existing general conversation has an unanswered question. */
  chatPending?: boolean
  /** General conversation displayed after the nearby stories. */
  conversation?: ReactNode
  /** Saved records displayed within the scrollable ledger. */
  savedReading?: ReactNode
}
