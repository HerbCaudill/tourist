import { useState } from "react"
import { ChatScreen } from "./components/ChatScreen"
import { NearbyScreen } from "./components/NearbyScreen"
import { StoryScreen } from "./components/StoryScreen"
import { RADIUS_METERS } from "./constants"
import { useConversations } from "./hooks/useConversations"
import { useDiscovery } from "./hooks/useDiscovery"
import { createFakeResearch } from "./lib/createFakeResearch"
import type { ConversationContext, Discovery, Location, Research, Story } from "./types"

/** The Tourist app: nearby stories, a story reader, and contextual chat. */
export function App(
  /** Explicit adapter injection for development and tests. */
  {
    research = defaultResearch,
  }: Props,
) {
  const [view, setView] = useState<View>({ kind: "nearby" })
  const { location, discovery, busy, progress, error, locationError, refresh, retry, choosePlace } =
    useDiscovery(research)
  const chat = useConversations(research)
  const stories = discovery?.stories ?? []
  const generalContext = location
    ? conversationContext(discovery?.location ?? location, discovery)
    : undefined
  const generalConversation = generalContext && chat.conversations[generalContext.id]

  /** Send a question while retaining this conversation's originating context. */
  const ask = (question: string, context: ConversationContext) => {
    if (!location) return
    setView({ kind: "chat", context })
    chat.ask(context, question, location)
  }

  const screen = (() => {
    if (view.kind === "story") {
      const { story, context } = view
      return (
        <StoryScreen
          story={story}
          number={context.number ?? 1}
          origin={context.originLocation}
          chatPending={!!chat.conversations[context.id]?.pending}
          onOpenChat={
            chat.conversations[context.id] ? () => setView({ kind: "chat", context }) : undefined
          }
          onBack={() => setView({ kind: "nearby" })}
          onAsk={question => ask(question, context)}
        />
      )
    }
    if (view.kind === "chat") {
      const { context } = view
      const story = context.stories.find(item => item.id === context.selectedStoryId)
      const conversation = chat.conversations[context.id]
      const messages = conversation?.messages ?? []
      const asked = new Set(messages.map(message => message.text))
      const suggestions =
        story?.suggestedQuestions ??
        context.stories.flatMap(item => item.suggestedQuestions ?? []).slice(0, 3)
      return (
        <ChatScreen
          story={story}
          number={context.number}
          contextLabel={story?.place ?? context.originLocation.name}
          messages={messages}
          answering={!!conversation?.pending && !conversation.error}
          error={conversation?.error}
          onRetry={() => chat.retry(context.id)}
          onRestart={() => chat.retry(context.id, true)}
          restartRequired={conversation?.restartRequired}
          suggestions={suggestions.filter(question => !asked.has(question))}
          onBack={() => setView(story ? { kind: "story", story, context } : { kind: "nearby" })}
          onAsk={question => ask(question, context)}
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
          if (index >= 0 && discovery)
            setView({
              kind: "story",
              story: stories[index],
              context: conversationContext(
                discovery.location,
                discovery,
                stories[index],
                index + 1,
              ),
            })
        }}
        chatPending={!!generalConversation?.pending}
        onOpenChat={
          generalContext && generalConversation
            ? () => setView({ kind: "chat", context: generalContext })
            : undefined
        }
        onAsk={question => {
          if (generalContext) ask(question, generalContext)
        }}
      />
    )
  })()

  return (
    <main className="mx-auto flex h-dvh max-w-md flex-col bg-[#eeeeec] font-mono text-[12.5px] leading-normal text-neutral-900">
      {screen}
    </main>
  )
}

/** Capture a stable source and location snapshot for general or story conversation. */
function conversationContext(
  /** Origin of the displayed story distances. */
  originLocation: Location,
  /** Latest complete discovery, when one exists. */
  discovery?: Discovery,
  /** Selected story, absent for a general chat. */
  story?: Story,
  /** Story number in its original list. */
  number?: number,
): ConversationContext {
  return {
    id: `${discovery?.researchedAt.toISOString() ?? "new"}/${originLocation.coordinates.lat}/${originLocation.coordinates.lon}/${story?.id ?? "general"}`,
    originLocation,
    stories: story ? [story] : (discovery?.stories ?? []),
    selectedStoryId: story?.id,
    number,
    researchedAt: discovery?.researchedAt.toISOString() ?? new Date().toISOString(),
    coordinatesExpireAt: discovery?.coordinatesExpireAt,
    promptVersion: discovery?.promptVersion,
  }
}

const defaultResearch = createFakeResearch()

type View =
  | { kind: "nearby" }
  | { kind: "story"; story: Story; context: ConversationContext }
  | { kind: "chat"; context: ConversationContext }

type Props = {
  /** Adapter for location and research. */
  research?: Research
}
