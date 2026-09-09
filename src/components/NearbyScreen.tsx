import { useState, type ReactNode } from "react"
import { cn } from "cn"
import { formatDistance } from "../lib/formatDistance"
import type { Discovery, Location, ResearchProgress } from "../types"
import { Cursor } from "./Cursor"
import { GoogleMap } from "./GoogleMap"
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
    offline,
    mapProvider,
    progress,
    error,
    onRefresh,
    onRetry,
    onChoosePlace,
    onOpenStory,
    onAsk,
    chatPending,
    onOpenChat,
    savedReading,
  }: Props,
) {
  const [query, setQuery] = useState("")
  const stories = discovery?.stories ?? []
  const origin = discovery?.location ?? location
  const moved =
    location &&
    origin &&
    (location.coordinates.lat !== origin.coordinates.lat ||
      location.coordinates.lon !== origin.coordinates.lon)
  const updated = discovery?.researchedAt.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })

  return (
    <>
      <HeaderLine
        left={
          <form
            className="flex min-w-0 items-center gap-1.5"
            onSubmit={event => {
              event.preventDefault()
              if (query.trim()) onChoosePlace(query.trim())
            }}
          >
            <b>tourist</b>
            <span className="text-neutral-500">@</span>
            <input
              aria-label="Enter a place"
              disabled={offline}
              placeholder={location?.name.toLowerCase() ?? "choose a place"}
              maxLength={200}
              value={query}
              onChange={event => setQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-neutral-500 focus:border-b focus:border-neutral-400"
            />
            {query.trim() && (
              <button
                type="submit"
                aria-label="Search"
                disabled={
                  offline || (researching && (!progress || query.trim() === location?.name))
                }
                className="shrink-0 text-red-700 disabled:text-neutral-400"
              >
                ↵
              </button>
            )}
          </form>
        }
        right={
          <>
            {location && `±${Math.round(location.accuracyMeters)}m `}
            {updated && `${updated} `}
            <button
              type="button"
              aria-label="Refresh"
              onClick={onRefresh}
              disabled={researching || offline}
              className={cn("text-red-700", researching && "animate-pulse")}
            >
              [r]
            </button>
          </>
        }
      />

      <div className="flex-1 overflow-y-auto px-[18px] pb-2">
        {error && (
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
        {!location && discovery && (
          <p className="my-2 text-neutral-500">
            Saved stories near {discovery.location.name.toLowerCase()}.
          </p>
        )}
        {moved && (
          <p className="my-2 text-neutral-500">
            Showing earlier stories near {origin.name.toLowerCase()}. Distances and map use that
            location.
          </p>
        )}
        {origin && (
          <div className="my-2.5">
            {(discovery?.mapProvider ?? mapProvider) === "google" ? (
              <GoogleMap location={origin} stories={stories} radiusMeters={radiusMeters} />
            ) : (
              <MiniMap
                you={origin.coordinates}
                markers={stories.map((story, index) => ({
                  label: String(index + 1),
                  coordinates: story.coordinates,
                }))}
                radiusMeters={radiusMeters}
              />
            )}
            <p className="mt-1 text-neutral-500">
              {radiusMeters > 200 ? "Expanded search" : "Search area"}:{" "}
              {formatDistance(radiusMeters)}
              {origin.accuracyMeters > 0 && ` · location ±${Math.round(origin.accuracyMeters)} m`}
            </p>
          </div>
        )}
        {researching && (
          <p role="status" className="py-1 text-neutral-500">
            {progress
              ? `${progress.status === "queued" ? "Waiting to research" : "Researching"} within ${formatDistance(progress.radiusMeters)}${progress.radiusMeters > 200 ? " · expanded search" : ""}`
              : "Finding your location"}{" "}
            <Cursor />
          </p>
        )}
        {!researching && discovery && stories.length === 0 && (
          <p className="py-1 text-neutral-500">
            Nothing worth telling within {formatDistance(radiusMeters)}. Try refreshing later.
          </p>
        )}
        <div className={cn(researching && stories.length > 0 && "opacity-60")}>
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
        {savedReading}
      </div>
      {onOpenChat && (
        <button
          type="button"
          onClick={onOpenChat}
          className="px-[18px] py-2 text-left text-red-700 underline"
        >
          Open conversation
        </button>
      )}
      <Prompt
        placeholder="ask about this place"
        onAsk={onAsk}
        disabled={!location || chatPending}
      />
    </>
  )
}

type Props = {
  /** Latest completed research. */
  discovery?: Discovery
  /** Current chosen or browser location. */
  location?: Location
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
  /** Search around a typed place. */
  onChoosePlace: (query: string) => void
  /** Open a story snapshot. */
  onOpenStory: (id: string) => void
  /** Start general chat. */
  onAsk: (question: string) => void
  /** Whether the existing general conversation has an unanswered question. */
  chatPending?: boolean
  /** Reopen the existing general conversation. */
  onOpenChat?: () => void
  /** Saved records displayed within the scrollable ledger. */
  savedReading?: ReactNode
}
