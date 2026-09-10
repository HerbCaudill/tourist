import type { ReactNode } from "react"
import { cn } from "cn"

/** The one-line header at the top of every ledger screen. */
export function HeaderLine(
  /** Left and right content. */
  {
    left,
    right,
    allowOverflow,
  }: Props,
) {
  return (
    <div className="shrink-0 px-[18px]">
      <div className="flex justify-between gap-3 pt-1">
        <div className={cn("min-w-0 flex-1", !allowOverflow && "truncate")}>{left}</div>
        <span className="shrink-0 text-neutral-500">{right}</span>
      </div>
    </div>
  )
}

type Props = {
  /** Left-aligned content. */
  left: ReactNode
  /** Right-aligned content. */
  right?: ReactNode
  /** Let the inline location autocomplete extend below the header. */
  allowOverflow?: boolean
}
