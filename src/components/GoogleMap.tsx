import { useEffect, useState } from "react"
import { formatDistance } from "../lib/formatDistance"
import type { Location, Story } from "../types"

/** Display the complete attributed Google map without exposing coordinates in a URL. */
export function GoogleMap(
  /** Geographic context belonging to the currently displayed discovery. */
  {
    location,
    stories,
    radiusMeters,
  }: Props,
) {
  const [image, setImage] = useState<{ request: string; url: string }>()
  const [failed, setFailed] = useState<string>()
  const request = JSON.stringify({
    center: location.coordinates,
    markers: stories.map(story => story.coordinates),
    radiusMeters,
  })

  useEffect(() => {
    const controller = new AbortController()
    let objectUrl: string | undefined
    void (async () => {
      try {
        const response = await fetch("/api/map", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: request,
          cache: "no-store",
          signal: AbortSignal.any([controller.signal, AbortSignal.timeout(30_000)]),
        })
        if (!response.ok || !response.headers.get("content-type")?.startsWith("image/"))
          throw new Error("map_unavailable")
        const blob = await response.blob()
        if (controller.signal.aborted) return
        objectUrl = URL.createObjectURL(blob)
        setImage({ request, url: objectUrl })
      } catch {
        if (!controller.signal.aborted) setFailed(request)
      }
    })()
    return () => {
      controller.abort()
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [request])

  return (
    <div className="min-h-[180px] border border-neutral-300 bg-neutral-200">
      {image?.request === request && failed !== request ? (
        <img
          src={image.url}
          alt={`Map of stories within ${formatDistance(radiusMeters)}`}
          className="block h-auto w-full"
          onError={() => setFailed(request)}
        />
      ) : (
        <p className="px-3 py-4 text-neutral-600">
          {failed === request
            ? "Map unavailable. The stories are still available below."
            : "Loading map…"}
        </p>
      )}
    </div>
  )
}

type Props = {
  /** Research origin, including its accuracy. */
  location: Location
  /** Numbered story anchors in row order. */
  stories: Story[]
  /** Bounded radius for these results. */
  radiusMeters: number
}
