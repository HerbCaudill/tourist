/** A canned answer for a question the prototype can recognise. */
export type Faq = {
  /** The question as offered to the user. */
  question: string
  /** Pattern that a typed question must match to get this answer. */
  matches: RegExp
  /** The answer text. */
  answer: string
  /** Where the answer comes from. */
  source?: string
}
