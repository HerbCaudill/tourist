import { useEffect, useState } from "react"
import type { Location, ResearchProgress } from "../types"

/** Type a temporary field notebook while the durable research job runs. */
export function ResearchFeed(
  /** Search context for this temporary feed. */
  {
    location,
    progress,
  }: Props,
) {
  const [length, setLength] = useState(0)
  const [tick, setTick] = useState(0)
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
  const showMessages =
    !!location &&
    (reducedMotion || length >= text.length) &&
    (places !== undefined || progress?.status === "running")

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
    const timer = setInterval(() => setTick(value => value + 1), 80)
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
        {!location && <p>Finding your location...</p>}
        {showMessages &&
          (reducedMotion ? (
            <p className="mt-2">Collecting obscure facts...</p>
          ) : (
            <ResearchMessage />
          ))}
        <p className="mt-2 text-[16px] text-red-700">
          {reducedMotion ? "⠿" : "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"[tick % 10]}
        </p>
      </div>
    </div>
  )
}

/** Type and erase one shuffled activity message at a time after the notebook finishes. */
function ResearchMessage() {
  const [messages] = useState(() => {
    const shuffled = [...MESSAGES]
    for (let index = shuffled.length - 1; index > 0; index--) {
      const other = Math.floor(Math.random() * (index + 1))
      ;[shuffled[index], shuffled[other]] = [shuffled[other], shuffled[index]]
    }
    return shuffled
  })
  const [frame, setFrame] = useState({ index: 0, length: 0, erasing: false })
  const message = messages[frame.index]

  useEffect(() => {
    const full = frame.length === message.length
    const empty = frame.length === 0
    const delay = frame.erasing
      ? 5 + Math.random() * 5
      : full
        ? 6500
        : empty
          ? 350
          : 15 + Math.random() * 30
    const timer = setTimeout(() => {
      if (frame.erasing)
        setFrame(
          frame.length <= 1
            ? { index: (frame.index + 1) % messages.length, length: 1, erasing: false }
            : { ...frame, length: frame.length - 1 },
        )
      else setFrame(full ? { ...frame, erasing: true } : { ...frame, length: frame.length + 1 })
    }, delay)
    return () => clearTimeout(timer)
  }, [frame, message, messages.length])

  return <p className="mt-2 min-h-6">{message.slice(0, frame.length)}</p>
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
}
