import { RADIUS_METERS } from "../constants"
import { generalFaq } from "../data/generalFaq"
import { location } from "../data/location"
import { stories } from "../data/stories"
import type { Answer, Faq, Location, Research, Story } from "../types"
import { compassBearing } from "./compassBearing"
import { distanceBetween } from "./distanceBetween"

/** Build a research adapter that returns canned Edinburgh data after a delay. */
export function createFakeResearch(
  /** Timing options. */
  { delayMs = 1800 }: Options = {},
): Research {
  return {
    locate: async () => {
      await wait(delayMs / 3)
      return location
    },
    resolveLocation: async query => ({ ...location, name: query }),
    discover: async where => {
      await wait(delayMs)
      return {
        location: where,
        stories: stories.map(story => withGeometry(story, where)),
        radiusMeters: RADIUS_METERS,
        researchedAt: new Date(),
      }
    },
    ask: async (question, story) => {
      await wait(delayMs)
      return answerFor(question, story)
    },
  }
}

/** Add the computed distance and bearing from the user to a story. */
const withGeometry = (story: Omit<Story, "distanceMeters" | "bearing">, from: Location): Story => ({
  ...story,
  distanceMeters: distanceBetween(from.coordinates, story.coordinates),
  bearing: compassBearing(from.coordinates, story.coordinates),
})

/** Pick the canned answer whose pattern matches the question, or a fallback. */
const answerFor = (question: string, story?: Story): Answer => {
  const candidates: Faq[] = story ? (story.faq ?? []) : generalFaq
  const hit = candidates.find(f => f.matches.test(question))
  if (hit) return { text: hit.answer, source: hit.source }
  const about = story ? `about ${story.place}` : "about this spot"
  return {
    text: `I don’t have notes on that ${about} yet. In the finished app this is where Tourist would go and research it. For now, try one of the suggested questions.`,
  }
}

/** Resolve after the given number of milliseconds. */
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms))

type Options = {
  /** How long each request pretends to take. */
  delayMs?: number
}
