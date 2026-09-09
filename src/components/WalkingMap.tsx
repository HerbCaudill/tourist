import { useEffect, useState } from "react"
import { IconWalk } from "@tabler/icons-react"
import { formatDistance } from "../lib/formatDistance"
import type { Coordinates } from "../types"

/** Show a real walking path and a link to turn-by-turn navigation. */
export function WalkingMap(
  /** Route endpoints and destination label. */
  {
    origin,
    destination,
    place,
    number,
  }: Props,
) {
  const request = JSON.stringify({ origin, destination, number })
  const [result, setResult] = useState<{
    request: string
    url: string
    meters: number
    seconds: number
  }>()
  const [failed, setFailed] = useState<string>()
  useEffect(() => {
    if (!origin) return
    const controller = new AbortController()
    let url: string | undefined
    void (async () => {
      try {
        const response = await fetch("/api/walk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: request,
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(45_000)]),
        })
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png"))
          throw new Error("route_unavailable")
        const blob = await response.blob()
        if (controller.signal.aborted) return
        url = URL.createObjectURL(blob)
        setFailed(undefined)
        setResult({
          request,
          url,
          meters: Number(response.headers.get("X-Walk-Meters")),
          seconds: Number(response.headers.get("X-Walk-Seconds")),
        })
      } catch {
        if (!controller.signal.aborted) setFailed(request)
      }
    })()
    return () => {
      controller.abort()
      if (url) URL.revokeObjectURL(url)
    }
  }, [request, !!origin])
  const directions = new URL("https://www.google.com/maps/dir/")
  directions.search = new URLSearchParams({
    api: "1",
    destination: `${destination.lat},${destination.lon}`,
    travelmode: "walking",
    ...(origin ? { origin: `${origin.lat},${origin.lon}` } : {}),
  }).toString()
  const current = result?.request === request && failed !== request ? result : undefined
  return (
    <figure className="-mx-[18px] my-3">
      {current ? (
        <img
          src={current.url}
          alt={`Walking route to ${place}`}
          className="block h-auto w-full"
          onError={() => setFailed(request)}
        />
      ) : (
        <p role="status" className="px-[18px] py-4 text-neutral-500">
          {!origin
            ? "Choose a starting location to see the walking route."
            : failed === request
              ? "Walking map unavailable."
              : "Finding a walking route…"}
        </p>
      )}
      <figcaption className="flex items-center justify-between gap-2 px-[18px] py-2 text-neutral-500">
        {current && (
          <span className="inline-flex items-center gap-1">
            <IconWalk size={16} aria-hidden="true" />
            {Math.max(1, Math.ceil(current.seconds / 60))} min · {formatDistance(current.meters)}
          </span>
        )}
        <a
          href={directions.href}
          target="_blank"
          rel="noreferrer"
          className="text-red-700 underline"
        >
          Walking directions ↗
        </a>
      </figcaption>
    </figure>
  )
}

type Props = {
  /** Story number matching the nearby map. */
  number: number
  /** Current GPS or manually selected starting point. */
  origin?: Coordinates
  /** Story's verified destination. */
  destination: Coordinates
  /** Accessible destination name. */
  place: string
}
