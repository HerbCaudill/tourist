import type { Kind } from "../types"

/** Show how well a story is supported, ledger style. */
export function KindTag(
  /** The kind to display. */
  {
    kind,
  }: Props,
) {
  return (
    <span className="text-neutral-500" title={titles[kind]}>
      [{labels[kind]}]
    </span>
  )
}

const labels: Record<Kind, string> = {
  documented: "doc",
  disputed: "disp",
  folklore: "folk",
}

const titles: Record<Kind, string> = {
  documented: "Documented",
  disputed: "Disputed",
  folklore: "Folklore",
}

type Props = {
  /** The kind to display. */
  kind: Kind
}
