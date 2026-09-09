/** A ledger-style back link labelled with the screen it returns to. */
export function BackButton(
  /** Label and handler. */
  {
    label,
    onClick,
  }: Props,
) {
  return (
    <button type="button" onClick={onClick} className="text-red-700">
      &lt; {label}
    </button>
  )
}

type Props = {
  /** Name of the screen this returns to. */
  label: string
  /** Called when tapped. */
  onClick: () => void
}
