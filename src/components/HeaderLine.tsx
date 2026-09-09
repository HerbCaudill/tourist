import type { ReactNode } from "react"

/** The one-line header at the top of every ledger screen, with a rule beneath. */
export function HeaderLine(
  /** Left and right content. */
  {
    left,
    right,
  }: Props,
) {
  return (
    <div className="shrink-0 px-[18px]">
      <div className="flex justify-between gap-3 pt-1">
        <div className="min-w-0 flex-1 truncate">{left}</div>
        <span className="shrink-0 text-neutral-500">{right}</span>
      </div>
      <hr className="mt-2 border-neutral-300" />
    </div>
  )
}

type Props = {
  /** Left-aligned content. */
  left: ReactNode
  /** Right-aligned content. */
  right?: ReactNode
}
