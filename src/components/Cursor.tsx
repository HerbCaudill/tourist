/** A blinking block cursor that signals Tourist is working. */
export function Cursor(
  /** Accepts no properties. */
  _props: Props,
) {
  return (
    <span
      aria-hidden="true"
      className="inline-block h-[15px] w-[7px] animate-pulse bg-neutral-900 align-text-bottom"
    />
  )
}

type Props = Record<string, never>
