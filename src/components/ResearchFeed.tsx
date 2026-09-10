import { useEffect, useState } from "react"
import type { Location, ResearchProgress } from "../types"

/** Type a temporary field notebook while the durable research job runs. */
export function ResearchFeed(
  /** Search context and attribution for this temporary feed. */
  {
    location,
    progress,
    google,
  }: Props,
) {
  const [length, setLength] = useState(0)
  const [tick, setTick] = useState(0)
  const [messages] = useState(() => {
    const shuffled = [...MESSAGES]
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
    }
    return shuffled
  })
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  )
  const radius = progress?.radiusMeters ?? 200
  const places = progress?.nearbyPlaces
  const text = location
    ? [
        `Location: ${location.coordinates.lat.toFixed(4)}, ${location.coordinates.lon.toFixed(4)}`,
        `Searching within ${radius}m...${radius > 200 ? " (expanded search)" : ""}`,
        ...(places?.length
          ? [
              "",
              "Nearby places:",
              ...places.map(place => `- ${place.name} (${place.distanceMeters}m)`),
            ]
          : []),
      ].join("\n")
    : ""

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!media) return
    const changed = () => setReducedMotion(media.matches)
    media.addEventListener("change", changed)
    return () => media.removeEventListener("change", changed)
  }, [])

  useEffect(() => {
    if (reducedMotion || length >= text.length) return
    const timer = setTimeout(
      () => setLength(value => value + 1),
      text[length] === "\n" ? 250 + Math.random() * 450 : 8 + Math.random() * 24,
    )
    return () => clearTimeout(timer)
  }, [length, text, reducedMotion])

  useEffect(() => {
    if (reducedMotion) return
    const timer = setInterval(() => setTick(value => value + 1), 120)
    return () => clearInterval(timer)
  }, [reducedMotion])

  return (
    <div className="py-3 font-mono text-[12px] leading-6 text-neutral-500">
      <p role="status" className="sr-only">
        {location
          ? `Researching within ${radius} m. Stories will appear when ready.`
          : "Finding your location"}
      </p>
      <div aria-hidden="true">
        <div className="break-words whitespace-pre-wrap">
          {reducedMotion ? text : text.slice(0, length)}
        </div>
        <div className="mt-2 flex items-start gap-2">
          <span className="inline-block w-[1ch] shrink-0 text-red-700">
            {reducedMotion ? ">" : "|/-\\"[tick % 4]}
          </span>
          <span>
            {!location
              ? "Finding your location..."
              : reducedMotion
                ? "Collecting obscure facts..."
                : messages[Math.floor(tick / 60) % messages.length]}
          </span>
        </div>
      </div>
      {google && !!places?.length && (
        <p className="mt-2 text-[10px]">
          Nearby places from <span className="font-medium">Google Maps</span>
        </p>
      )}
    </div>
  )
}

const MESSAGES = [
  "Collecting obscure facts...",
  "Poking around the past...",
  "Looking for local legends...",
  "Following a few leads...",
  "Dusting off old stories...",
  "Looking for the unexpected...",
  "Finding stories worth a detour...",
  "Exploring the neighborhood...",
]

type Props = {
  /** Current search origin, absent while location resolves. */
  location?: Location
  /** Radius and temporary nearby search results. */
  progress?: ResearchProgress
  /** Attribute names supplied by the Google nearby search. */
  google?: boolean
}
