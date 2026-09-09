import { Schema } from "effect"
import { boundedText } from "./boundedText.ts"

/** Independently retrieved evidence for a historical claim. */
export const ResearchSource = Schema.Struct({
  /** Page or document title. */
  name: boundedText(300),
  /** Institution or publication. */
  org: boundedText(200),
  /** Direct HTTP(S) evidence link. */
  url: boundedText(2048).pipe(Schema.filter(isSourceUrl)),
})

/** Permit only HTTP(S) evidence links without embedded credentials. */
function isSourceUrl(value: string) {
  try {
    const url = new URL(value)
    return ["http:", "https:"].includes(url.protocol) && !url.username && !url.password
  } catch {
    return false
  }
}

/** Serializable ResearchSource contract inferred from its boundary schema. */
export type ResearchSource = typeof ResearchSource.Type
