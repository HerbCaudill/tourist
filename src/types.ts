/** How well a story's central claim is supported. */
export type Kind = "documented" | "disputed" | "folklore"

/** A point on the earth. */
export type Coordinates = {
  /** Latitude in degrees. */
  lat: number
  /** Longitude in degrees. */
  lon: number
}

/** A reference the reader can follow to check a story. */
export type Source = {
  /** Title of the page or document. */
  name: string
  /** Institution or publication behind it. */
  org: string
  /** Where to read it. */
  url: string
}

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

/** One memorable story tied to a nearby place. */
export type Story = {
  /** Stable identifier. */
  id: string
  /** The place the story belongs to. */
  place: string
  /** Where the place is. */
  coordinates: Coordinates
  /** Approximate straight-line distance from the user, computed in app code. */
  distanceMeters: number
  /** Direction from the user, computed in app code. */
  bearing: string
  /** Headline that teaches something on its own. */
  title: string
  /** Two or three sentences that stand alone in the feed. */
  preview: string
  /** Fuller account, one paragraph per entry. */
  account: string[]
  /** How well the story is supported. */
  kind: Kind
  /** References for the reader. */
  sources: Source[]
  /** Questions the prototype can answer about this story. */
  faq: Faq[]
}

/** The user's active location as shown in the header. */
export type Location = {
  /** Street or landmark name. */
  name: string
  /** Neighbourhood and city. */
  area: string
  /** Where the user is. */
  coordinates: Coordinates
  /** Reported GPS accuracy. */
  accuracyMeters: number
}

/** The result of one research pass around a location. */
export type Discovery = {
  /** Where the research was centred. */
  location: Location
  /** Stories found, strongest first. */
  stories: Story[]
  /** Search radius that produced these stories. */
  radiusMeters: number
  /** When the research completed. */
  researchedAt: Date
}

/** A reply from the research backend to a question. */
export type Answer = {
  /** The reply text. */
  text: string
  /** Where the answer comes from, if known. */
  source?: string
}

/** One turn in a conversation. */
export type Message = {
  /** Stable identifier. */
  id: string
  /** Who said it. */
  role: "user" | "tourist"
  /** What was said. */
  text: string
  /** Source cited by a Tourist reply. */
  source?: string
}

/** The narrow adapter the app uses to reach location and a research backend. */
export type Research = {
  /** Find out where the user is. */
  locate: () => Promise<Location>
  /** Find stories around a location. */
  discover: (
    /** Where to search. */
    location: Location,
  ) => Promise<Discovery>
  /** Answer a question, optionally about a specific story. */
  ask: (
    /** What the user typed. */
    question: string,
    /** The story the question is about, if any. */
    story?: Story,
  ) => Promise<Answer>
}
