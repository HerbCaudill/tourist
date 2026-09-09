import { useState } from "react"
import { ChatScreen } from "./components/ChatScreen"
import { NearbyScreen } from "./components/NearbyScreen"
import { StoryScreen } from "./components/StoryScreen"
import { RADIUS_METERS } from "./constants"
import { generalFaq } from "./data/generalFaq"
import { useDiscovery } from "./hooks/useDiscovery"
import { createFakeResearch } from "./lib/createFakeResearch"
import type { Location, Message, Research, Story } from "./types"

/** The Tourist app: nearby stories, a story reader, and contextual chat. */
export function App(
  /** Optional research adapter, mainly so tests can remove the fake delay. */
  {
    research = defaultResearch,
  }: Props,
) {
  const [view, setView] = useState<View>({ kind: "nearby" })
  const { location, discovery, busy, progress, error, locationError, refresh, retry, choosePlace } =
    useDiscovery(research)
  const [conversations, setConversations] = useState<Record<string, Message[]>>({})
  const [answering, setAnswering] = useState(false)
  const [chatError, setChatError] = useState<string>()

  const stories = discovery?.stories ?? []

  /** Send a question in the conversation for a story, or the general one. */
  const ask = async (question: string, story?: Story) => {
    const key = story?.id ?? GENERAL
    setView({
      kind: "chat",
      snapshot: story
        ? {
            story,
            origin:
              view.kind !== "nearby" && view.snapshot ? view.snapshot.origin : discovery?.location,
            number:
              view.kind !== "nearby" && view.snapshot
                ? view.snapshot.number
                : stories.indexOf(story) + 1,
          }
        : undefined,
    })
    setConversations(c => ({
      ...c,
      [key]: [...(c[key] ?? []), { id: nextId(), role: "user", text: question }],
    }))
    setAnswering(true)
    setChatError(undefined)
    try {
      const answer = await research.ask(question, story)
      setConversations(c => ({
        ...c,
        [key]: [
          ...(c[key] ?? []),
          { id: nextId(), role: "tourist", text: answer.text, source: answer.source },
        ],
      }))
    } catch {
      setChatError("The answer could not be retrieved. Please try again.")
    } finally {
      setAnswering(false)
    }
  }

  const screen = (() => {
    if (view.kind === "story") {
      const { story, number } = view.snapshot
      return (
        <StoryScreen
          story={story}
          number={number}
          origin={view.snapshot.origin}
          onBack={() => setView({ kind: "nearby" })}
          onAsk={q => ask(q, story)}
        />
      )
    }
    if (view.kind === "chat") {
      const story = view.snapshot?.story
      const key = story?.id ?? GENERAL
      const asked = new Set((conversations[key] ?? []).map(m => m.text))
      const suggestions = story
        ? (story.suggestedQuestions ?? story.faq?.map(f => f.question) ?? [])
        : generalFaq.map(f => f.question)
      return (
        <ChatScreen
          story={story}
          number={view.snapshot?.number}
          contextLabel={story ? story.id : (location?.name ?? "here")}
          messages={conversations[key] ?? []}
          answering={answering}
          suggestions={suggestions.filter(q => !asked.has(q))}
          onBack={() =>
            setView(view.snapshot ? { kind: "story", snapshot: view.snapshot } : { kind: "nearby" })
          }
          onAsk={q => ask(q, story)}
        />
      )
    }
    return (
      <NearbyScreen
        discovery={discovery}
        location={location}
        radiusMeters={discovery?.radiusMeters ?? RADIUS_METERS}
        researching={busy}
        mapProvider={research.mapProvider}
        progress={progress}
        error={error}
        locationError={locationError}
        onRetry={retry}
        onChoosePlace={choosePlace}
        onRefresh={refresh}
        onOpenStory={id => {
          const index = stories.findIndex(story => story.id === id)
          if (index >= 0)
            setView({
              kind: "story",
              snapshot: { story: stories[index], number: index + 1, origin: discovery?.location },
            })
        }}
        onAsk={q => ask(q)}
      />
    )
  })()

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[#eeeeec] font-mono text-[12.5px] leading-normal text-neutral-900">
      {chatError && view.kind === "chat" && (
        <p role="alert" className="px-[18px] py-2 text-red-700">
          {chatError}
        </p>
      )}
      {screen}
    </main>
  )
}

/** Produce a unique id for a message. */
const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const defaultResearch = createFakeResearch()

const GENERAL = "general"

type StorySnapshot = {
  /** Full reading context retained across replacement discoveries. */
  story: Story
  /** The number shown when the story was opened. */
  number: number
  /** Origin from which the displayed distance was measured. */
  origin?: Location
}

type View =
  | { kind: "nearby" }
  | { kind: "story"; snapshot: StorySnapshot }
  | { kind: "chat"; snapshot?: StorySnapshot }

type Props = {
  /** Adapter for location and research. */
  research?: Research
}
