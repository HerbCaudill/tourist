import { useState } from "react"
import { createMapGeometry } from "./createMapGeometry"
import { useElementWidth } from "../hooks/useElementWidth"
import { formatDistance } from "../lib/formatDistance"
import type { Coordinates } from "../types"

/** A small static map of the user's position and numbered story markers. */
export function MiniMap(
  /** What to plot. */
  {
    you,
    markers,
    radiusMeters,
    zoom,
    accuracyMeters,
    height = 200,
  }: Props,
) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const [failedTile, setFailedTile] = useState<string>()
  const map = createMapGeometry({
    you,
    markers: markers.map(m => m.coordinates),
    radiusMeters,
    accuracyMeters,
    width,
    height,
    zoom,
  })
  const { tiles, toLocal, you: youPx, radius: radiusPx } = map
  const viewport = `${you.lat}/${you.lon}/${radiusMeters}/${width}/${height}/${map.zoom}`

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Map of stories within ${formatDistance(radiusMeters)}${accuracyMeters ? `; location accuracy approximately ${formatDistance(accuracyMeters)}` : ""}`}
      className="relative overflow-hidden border border-neutral-300 bg-neutral-200"
      style={{ height }}
    >
      {tiles.map(tile => (
        <img
          key={`${map.zoom}/${tile.left}/${tile.top}`}
          src={`https://tile.openstreetmap.org/${map.zoom}/${tile.x}/${tile.y}.png`}
          alt=""
          draggable={false}
          onError={event => {
            event.currentTarget.style.visibility = "hidden"
            setFailedTile(viewport)
          }}
          className="absolute size-64 max-w-none opacity-80 grayscale select-none"
          style={{ left: tile.left, top: tile.top }}
        />
      ))}
      {width > 0 && (
        <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
          {map.accuracy > 0 && (
            <circle
              cx={youPx.x}
              cy={youPx.y}
              r={map.accuracy}
              fill="#525252"
              fillOpacity={0.12}
              stroke="#737373"
              strokeDasharray="2 3"
            />
          )}
          <circle
            cx={youPx.x}
            cy={youPx.y}
            r={radiusPx}
            fill="none"
            stroke="#b91c1c"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
          {markers.map(marker => {
            const p = toLocal(marker.coordinates)
            return (
              <g key={marker.label}>
                <circle cx={p.x} cy={p.y} r={9} fill="#b91c1c" />
                <text
                  x={p.x}
                  y={p.y + 3.5}
                  textAnchor="middle"
                  fontFamily="IBM Plex Mono, monospace"
                  fontSize={10}
                  fontWeight={600}
                  fill="#fff"
                >
                  {marker.label}
                </text>
              </g>
            )
          })}
          <circle cx={youPx.x} cy={youPx.y} r={5} fill="#111" stroke="#fff" strokeWidth={2} />
        </svg>
      )}
      {failedTile === viewport && (
        <span
          role="status"
          className="absolute top-1 left-1.5 bg-neutral-100/90 px-1 text-[10px] text-neutral-700"
        >
          Map tiles unavailable · locations still shown
        </span>
      )}
      <span className="absolute bottom-1 left-1.5 text-[10px] text-neutral-700">
        r = {formatDistance(radiusMeters)}
        {accuracyMeters ? ` · GPS ±${formatDistance(accuracyMeters)}` : ""}
      </span>
      <a
        href="https://www.openstreetmap.org/copyright"
        target="_blank"
        rel="noreferrer"
        className="absolute right-1.5 bottom-1 text-[9px] text-neutral-600"
      >
        © OpenStreetMap
      </a>
    </div>
  )
}

type Props = {
  /** Where the user is. */
  you: Coordinates
  /** Numbered places to mark. */
  markers: { label: string; coordinates: Coordinates }[]
  /** Search radius to draw around the user. */
  radiusMeters: number
  /** GPS uncertainty radius in meters, when supplied. */
  accuracyMeters?: number
  /** Optional maximum zoom; searches still fit the viewport. */
  zoom?: number
  /** Height in pixels. */
  height?: number
}
