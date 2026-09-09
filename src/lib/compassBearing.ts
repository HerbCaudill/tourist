import type { Coordinates } from "../types"

/** Eight-point compass direction from one point to another, such as "NE". */
export function compassBearing(
  /** Where the user is. */
  from: Coordinates,
  /** Where the place is. */
  to: Coordinates,
) {
  const φ1 = toRadians(from.lat)
  const φ2 = toRadians(to.lat)
  const Δλ = toRadians(to.lon - from.lon)
  const y = Math.sin(Δλ) * Math.cos(φ2)
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ)
  const degrees = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360
  return POINTS[Math.round(degrees / 45) % 8]
}

/** Convert degrees to radians. */
const toRadians = (degrees: number) => (degrees * Math.PI) / 180

const POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"]
