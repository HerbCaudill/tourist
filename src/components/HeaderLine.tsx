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
    // WebKit recognizes sticky top bars and can extend their solid background beneath the status bar.
    <header className="bg-background sticky top-0 z-30 w-full shrink-0 px-[18px] pt-[env(safe-area-inset-top)]">
      <div className="flex justify-between gap-3 pt-1">
        <div className={cn("min-w-0 flex-1", !allowOverflow && "truncate")}>{left}</div>
        <span className="shrink-0 text-neutral-500">{right}</span>
      </div>
    </header>
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
