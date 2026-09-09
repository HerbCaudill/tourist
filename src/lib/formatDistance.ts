/** Format an approximate straight-line distance for display, rounded to 10 m. */
export function formatDistance(
  /** Distance in metres. */
  meters: number,
) {
  if (meters < 1000) return `${Math.round(meters / 10) * 10} m`
  return `${(meters / 1000).toFixed(1)} km`
}
