/** Mark the map origin with a red dot and fine outward rings during research. */
export function LocationMarker(
  /** Position in the map image, centered by default. */
  {
    researching,
    left = "50%",
    top = "50%",
  }: Props,
) {
  return (
    <svg
      aria-hidden="true"
      className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 text-red-700"
      style={{ left, top }}
      width="200"
      height="200"
      viewBox="0 0 200 200"
    >
      {researching &&
        [0, 1, 2, 3].map(index => (
          <circle
            key={index}
            className="location-ripple"
            cx="100"
            cy="100"
            r="0"
            fill="none"
            stroke="currentColor"
            strokeWidth="0.5"
            style={{ animationDelay: `${index * -0.8}s` }}
          />
        ))}
      <circle cx="100" cy="100" r="4" fill="currentColor" />
    </svg>
  )
}

type Props = {
  /** Whether research is running. */
  researching?: boolean
  /** Horizontal position in pixels or percent. */
  left?: number | string
  /** Vertical position in pixels or percent. */
  top?: number | string
}
