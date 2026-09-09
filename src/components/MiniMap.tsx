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
    zoom = 16,
    height = 200,
  }: Props,
) {
  const [ref, width] = useElementWidth<HTMLDivElement>()
  const center = centroid([you, ...markers.map(m => m.coordinates)])
  const c = project(center, zoom)
  const origin = { x: c.x - width / 2, y: c.y - height / 2 }
  const toLocal = (p: Coordinates) => {
    const w = project(p, zoom)
    return { x: w.x - origin.x, y: w.y - origin.y }
  }
  const tiles = width > 0 ? tilesCovering(origin, width, height) : []
  const youPx = toLocal(you)
  const radiusPx = radiusMeters / metersPerPixel(you.lat, zoom)

  return (
    <div
      ref={ref}
      role="img"
      aria-label={`Map of stories within ${formatDistance(radiusMeters)}`}
      className="relative overflow-hidden border border-neutral-300 bg-neutral-200"
      style={{ height }}
    >
      {tiles.map(tile => (
        <img
          key={`${tile.x}/${tile.y}`}
          src={`https://tile.openstreetmap.org/${zoom}/${tile.x}/${tile.y}.png`}
          alt=""
          draggable={false}
          className="absolute size-64 max-w-none opacity-80 grayscale select-none"
          style={{ left: tile.x * TILE - origin.x, top: tile.y * TILE - origin.y }}
        />
      ))}
      {width > 0 && (
        <svg className="absolute inset-0" width={width} height={height} aria-hidden="true">
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
      <span className="absolute bottom-1 left-1.5 text-[10px] text-neutral-700">
        r = {formatDistance(radiusMeters)}
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

/** Web Mercator projection of a point to world pixel space at a zoom level. */
const project = (p: Coordinates, zoom: number) => {
  const n = 2 ** zoom * TILE
  const φ = (p.lat * Math.PI) / 180
  return {
    x: ((p.lon + 180) / 360) * n,
    y: ((1 - Math.log(Math.tan(φ) + 1 / Math.cos(φ)) / Math.PI) / 2) * n,
  }
}

/** Ground resolution of one pixel at a latitude and zoom level. */
const metersPerPixel = (lat: number, zoom: number) =>
  (156_543.03 * Math.cos((lat * Math.PI) / 180)) / 2 ** zoom

/** Average of a set of points, good enough for a neighbourhood. */
const centroid = (points: Coordinates[]): Coordinates => ({
  lat: points.reduce((sum, p) => sum + p.lat, 0) / points.length,
  lon: points.reduce((sum, p) => sum + p.lon, 0) / points.length,
})

/** Tile indices needed to cover a viewport whose top-left is at `origin` in world pixels. */
const tilesCovering = (origin: { x: number; y: number }, width: number, height: number) => {
  const x0 = Math.floor(origin.x / TILE)
  const x1 = Math.floor((origin.x + width) / TILE)
  const y0 = Math.floor(origin.y / TILE)
  const y1 = Math.floor((origin.y + height) / TILE)
  const tiles = []
  for (let x = x0; x <= x1; x++) for (let y = y0; y <= y1; y++) tiles.push({ x, y })
  return tiles
}

const TILE = 256

type Props = {
  /** Where the user is. */
  you: Coordinates
  /** Numbered places to mark. */
  markers: { label: string; coordinates: Coordinates }[]
  /** Search radius to draw around the user. */
  radiusMeters: number
  /** Slippy-map zoom level. */
  zoom?: number
  /** Height in pixels. */
  height?: number
}
