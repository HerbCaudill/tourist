import { useEffect, useState } from "react"

/** Show the shared waiting animation, respecting reduced motion preferences. */
export function BrailleSpinner(
  /** Accepts no properties. */
  _props: Props,
) {
  const [tick, setTick] = useState(0)
  const [reducedMotion, setReducedMotion] = useState(
    () => window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false,
  )

  useEffect(() => {
    const media = window.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!media) return
    const changed = () => setReducedMotion(media.matches)
    media.addEventListener("change", changed)
    return () => media.removeEventListener("change", changed)
  }, [])

  useEffect(() => {
    if (reducedMotion) return
    const timer = setInterval(() => setTick(value => value + 1), 80)
    return () => clearInterval(timer)
  }, [reducedMotion])

  return (
    <span aria-hidden="true" className="font-mono text-[16px] text-red-700">
      {reducedMotion ? "⠿" : "⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏"[tick % 10]}
    </span>
  )
}

type Props = Record<string, never>
