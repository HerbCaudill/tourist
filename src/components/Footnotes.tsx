import type { Source } from "../types"

/** Numbered source links at the foot of a story. */
export function Footnotes(
  /** The sources to list. */
  {
    sources,
  }: Props,
) {
  return (
    <ol className="mt-2 border-t border-neutral-300 pt-2 text-[12px] text-neutral-500">
      {sources.map((source, i) => (
        <li key={source.url + source.name}>
          <a href={source.url} target="_blank" rel="noreferrer" className="hover:underline">
            <span className="text-red-700">[{i + 1}]</span> {source.org.toLowerCase()} —{" "}
            {source.name.toLowerCase()} ↗
          </a>
        </li>
      ))}
    </ol>
  )
}

type Props = {
  /** The sources to list. */
  sources: Source[]
}
