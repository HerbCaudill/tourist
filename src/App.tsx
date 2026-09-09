import { useCallback, useEffect, useRef, useState } from "react"
import { ChatScreen } from "./components/ChatScreen"
import { NearbyScreen } from "./components/NearbyScreen"
import { StoryScreen } from "./components/StoryScreen"
import { RADIUS_METERS } from "./constants"
import { generalFaq } from "./data/generalFaq"
import { createFakeResearch } from "./lib/createFakeResearch"
import type { Discovery, Location, Message, Research, Story } from "./types"

/** The Tourist app: nearby stories, a story reader, and contextual chat. */
export function App(
  /** Optional research adapter, mainly so tests can remove the fake delay. */
  {
    research = defaultResearch,
  }: Props,
) {
  const [view, setView] = useState<View>({ kind: "nearby" })
  const [location, setLocation] = useState<Location>()
  const [discovery, setDiscovery] = useState<Discovery>()
  const [researching, setResearching] = useState(false)
  const [conversations, setConversations] = useState<Record<string, Message[]>>({})
  const [answering, setAnswering] = useState(false)
  const requestId = useRef(0)

  /** Run discovery around a location, ignoring results superseded by a newer request. */
  const discover = useCallback(
    async (where: Location) => {
      const id = ++requestId.current
      setResearching(true)
      try {
        const result = await research.discover(where)
        if (id !== requestId.current) return
        setDiscovery(result)
      } finally {
        if (id === requestId.current) setResearching(false)
      }
    },
    [research],
  )

  useEffect(() => {
    let cancelled = false
    setResearching(true)
    research.locate().then(where => {
      if (cancelled) return
      setLocation(where)
      discover(where)
    })
    return () => {
      cancelled = true
    }
  }, [research, discover])

  const stories = discovery?.stories ?? []
  const storyById = (id: string) => stories.find(s => s.id === id)
  const numberOf = (story: Story) => stories.indexOf(story) + 1

  /** Send a question in the conversation for a story, or the general one. */
  const ask = async (question: string, story?: Story) => {
    const key = story?.id ?? GENERAL
    setView({ kind: "chat", storyId: story?.id })
    setConversations(c => ({
      ...c,
      [key]: [...(c[key] ?? []), { id: nextId(), role: "user", text: question }],
    }))
    setAnswering(true)
    try {
      const answer = await research.ask(question, story)
      setConversations(c => ({
        ...c,
        [key]: [
          ...(c[key] ?? []),
          { id: nextId(), role: "tourist", text: answer.text, source: answer.source },
        ],
      }))
    } finally {
      setAnswering(false)
    }
  }

  const screen = (() => {
    if (view.kind === "story") {
      const story = storyById(view.id)
      if (!story) return null
      return (
        <StoryScreen
          story={story}
          number={numberOf(story)}
          onBack={() => setView({ kind: "nearby" })}
          onAsk={q => ask(q, story)}
        />
      )
    }
    if (view.kind === "chat") {
      const story = view.storyId ? storyById(view.storyId) : undefined
      const key = story?.id ?? GENERAL
      const asked = new Set((conversations[key] ?? []).map(m => m.text))
      const faq = story ? story.faq : generalFaq
      return (
        <ChatScreen
          story={story}
          number={story && numberOf(story)}
          contextLabel={story ? story.id : (location?.name ?? "here")}
          messages={conversations[key] ?? []}
          answering={answering}
          suggestions={faq.map(f => f.question).filter(q => !asked.has(q))}
          onBack={() => setView(story ? { kind: "story", id: story.id } : { kind: "nearby" })}
          onAsk={q => ask(q, story)}
        />
      )
    }
    return (
      <NearbyScreen
        discovery={discovery}
        location={location}
        radiusMeters={discovery?.radiusMeters ?? RADIUS_METERS}
        researching={researching}
        onRefresh={() => location && discover(location)}
        onOpenStory={id => setView({ kind: "story", id })}
        onAsk={q => ask(q)}
      />
    )
  })()

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[#eeeeec] font-mono text-[12.5px] leading-normal text-neutral-900">
      {screen}
    </main>
  )
}

/** Produce a unique id for a message. */
const nextId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`

const defaultResearch = createFakeResearch()

const GENERAL = "general"

type View = { kind: "nearby" } | { kind: "story"; id: string } | { kind: "chat"; storyId?: string }

type Props = {
  /** Adapter for location and research. */
  research?: Research
}
