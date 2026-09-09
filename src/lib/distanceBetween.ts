import type { Coordinates } from "../types"

/** Straight-line distance between two points in metres, by the haversine formula. */
export function distanceBetween(
  /** Starting point. */
  a: Coordinates,
  /** Ending point. */
  b: Coordinates,
) {
  const φ1 = toRadians(a.lat)
  const φ2 = toRadians(b.lat)
  const Δφ = toRadians(b.lat - a.lat)
  const Δλ = toRadians(b.lon - a.lon)
  const h = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return 2 * EARTH_RADIUS_METERS * Math.asin(Math.sqrt(h))
}

/** Convert degrees to radians. */
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const EARTH_RADIUS_METERS = 6_371_000
