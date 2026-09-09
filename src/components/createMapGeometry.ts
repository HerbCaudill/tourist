import type { Coordinates } from "../types"

/** Frame the search circle, location accuracy, and markers in a wrapped Mercator viewport. */
export function createMapGeometry(
  /** Map contents and available dimensions. */
  {
    you,
    markers,
    radiusMeters,
    accuracyMeters = 0,
    width,
    height,
    zoom: maxZoom = 19,
  }: Options,
) {
  const center = project(you)
  /** Project longitude into the world copy nearest the user. */
  const near = (point: Coordinates) => {
    const p = project(point)
    return { x: center.x + ((p.x - center.x + 1.5) % 1) - 0.5, y: p.y }
  }
  const metersPerWorld = 40_075_016.686 * Math.cos((clampLatitude(you.lat) * Math.PI) / 180)
  const radius = Math.max(0, radiusMeters) / metersPerWorld
  const accuracy = Math.max(0, accuracyMeters) / metersPerWorld
  const extent = Math.max(radius, accuracy)
  const points = [
    { x: center.x - extent, y: center.y - extent },
    { x: center.x + extent, y: center.y + extent },
    ...markers.map(near),
  ]
  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  const minY = Math.min(...points.map(p => p.y))
  const maxY = Math.max(...points.map(p => p.y))
  const scale = Math.min(
    Math.max(1, width - 36) / Math.max(maxX - minX, 1e-10),
    Math.max(1, height - 36) / Math.max(maxY - minY, 1e-10),
  )
  const zoom = Math.max(0, Math.min(19, maxZoom, Math.floor(Math.log2(scale / 256))))
  const world = 256 * 2 ** zoom
  const origin = {
    x: ((minX + maxX) / 2) * world - width / 2,
    y: ((minY + maxY) / 2) * world - height / 2,
  }
  /** Position a coordinate within the fitted viewport. */
  const toLocal = (point: Coordinates) => {
    const p = near(point)
    return { x: p.x * world - origin.x, y: p.y * world - origin.y }
  }
  const tiles = []
  const count = 2 ** zoom
  for (let x = Math.floor(origin.x / 256); x < Math.ceil((origin.x + width) / 256); x++) {
    for (
      let y = Math.max(0, Math.floor(origin.y / 256));
      y < Math.min(count, Math.ceil((origin.y + height) / 256));
      y++
    ) {
      tiles.push({
        x: ((x % count) + count) % count,
        y,
        left: x * 256 - origin.x,
        top: y * 256 - origin.y,
      })
    }
  }
  return {
    zoom,
    tiles,
    toLocal,
    you: toLocal(you),
    radius: radius * world,
    accuracy: accuracy * world,
  }
}

/** Limit coordinates to the latitude supported by Mercator tiles. */
const clampLatitude = (
  /** Geographic latitude. */
  lat: number,
) => Math.max(-85.05112878, Math.min(85.05112878, lat))

/** Convert geographic coordinates to a normalized Mercator world. */
const project = (
  /** Geographic position. */
  point: Coordinates,
) => {
  const latitude = (clampLatitude(point.lat) * Math.PI) / 180
  return {
    x: ((((point.lon + 180) / 360) % 1) + 1) % 1,
    y: (1 - Math.asinh(Math.tan(latitude)) / Math.PI) / 2,
  }
}

type Options = {
  /** Current position. */
  you: Coordinates
  /** Story positions. */
  markers: Coordinates[]
  /** Search radius in meters. */
  radiusMeters: number
  /** GPS uncertainty in meters. */
  accuracyMeters?: number
  /** Viewport width. */
  width: number
  /** Viewport height. */
  height: number
  /** Optional maximum zoom. */
  zoom?: number
}
