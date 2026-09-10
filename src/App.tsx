import { useCallback, useMemo, useState } from "react"
import { ChatTranscript } from "./components/ChatTranscript"
import { NearbyScreen } from "./components/NearbyScreen"
import { SavedReading } from "./components/SavedReading"
import { StoryScreen } from "./components/StoryScreen"
import { RADIUS_METERS } from "./constants"
import { useNavigation } from "./hooks/useNavigation"
import { useConversations } from "./hooks/useConversations"
import { useOnline } from "./hooks/useOnline"
import { createHistoryStore } from "./lib/createHistoryStore"
import { useDiscovery } from "./hooks/useDiscovery"
import { createLiveResearch } from "./lib/createLiveResearch"
import type { ConversationContext, Discovery, Location, Research, Story } from "./types"

/** The Tourist app: nearby stories, a story reader, and contextual chat. */
export function App(
  /** Explicit adapter injection for development and tests. */
  {
    research = defaultResearch,
    history: suppliedHistory,
  }: Props,
) {
  const online = useOnline()
  const [history] = useState(
    () => suppliedHistory ?? (research.mapProvider === "google" ? createHistoryStore() : undefined),
  )
  const [historyRevision, setHistoryRevision] = useState(0)
  const changed = useCallback(() => setHistoryRevision(value => value + 1), [])
  const saved = useMemo(() => history?.read(), [history, historyRevision])
  const nearby = useDiscovery(research, history, changed)
  const { location, discovery, busy, progress, error, locationError, refresh, retry, choosePlace } =
    nearby
  const chat = useConversations(research, history, changed)
  const [clearError, setClearError] = useState(false)

  /** Erase archive and in-memory records, stopping any pending result from saving them again. */
  const clearHistory = () => {
    nearby.clear()
    chat.clear()
    setClearError(history ? !history.clear() : false)
    changed()
    navigation.clear()
  }

  const contexts = [
    ...[...(discovery ? [discovery] : []), ...(saved?.discoveries ?? [])].flatMap(item => [
      conversationContext(item.location, item),
      ...item.stories.map((story, index) =>
        conversationContext(item.location, item, story, index + 1),
      ),
    ]),
    ...Object.values(chat.conversations).map(conversation => conversation.context),
  ]
  const navigation = useNavigation(contexts)
  const { view, navigate: setView } = navigation
  const archivedContext =
    view?.kind === "chat" && !view.context.selectedStoryId ? view.context : undefined
  const displayedDiscovery = archivedContext
    ? ([discovery, ...(saved?.discoveries ?? [])].find(
        item => item?.researchedAt.toISOString() === archivedContext.researchedAt,
      ) ?? {
        location: archivedContext.originLocation,
        stories: archivedContext.stories,
        researchedAt: new Date(archivedContext.researchedAt),
        radiusMeters: RADIUS_METERS,
      })
    : discovery
  const stories = displayedDiscovery?.stories ?? []
  const origin = displayedDiscovery?.location ?? location
  const generalContext =
    archivedContext ?? (origin ? conversationContext(origin, displayedDiscovery) : undefined)
  const generalConversation = generalContext && chat.conversations[generalContext.id]

  /** Send a question while retaining this conversation's originating context. */
  const ask = (question: string, context: ConversationContext) => {
    if (!location || !online) return
    chat.ask(context, question, location)
  }

  const screen = (() => {
    if (!view)
      return (
        <div className="px-[18px] py-4">
          <p role="status">
            {busy ? "Loading saved reading…" : "This page is no longer saved on this device."}
          </p>
          <button
            type="button"
            className="mt-2 text-red-700 underline"
            onClick={() => navigation.back({ kind: "nearby" })}
          >
            Back to nearby
          </button>
        </div>
      )
    if (view.kind === "story" || view.kind === "chat") {
      const { context } = view
      const story = context.stories.find(item => item.id === context.selectedStoryId)
      const conversation = chat.conversations[context.id]
      const messages = conversation?.messages ?? []
      const asked = new Set(messages.map(message => message.text))
      const suggestions =
        story?.suggestedQuestions ??
        context.stories.flatMap(item => item.suggestedQuestions ?? []).slice(0, 3)
      const conversationProps = {
        messages,
        answering: !!conversation?.pending && !conversation.error,
        error: conversation?.error,
        onRetry: () => chat.retry(context.id),
        onRestart: () => chat.retry(context.id, true),
        restartRequired: conversation?.restartRequired,
        offline: !online,
        questionDisabled: !location,
        suggestions: suggestions.filter(question => !asked.has(question)),
        onAsk: (question: string) => ask(question, context),
      }
      if (story && !busy)
        return (
          <StoryScreen
            key={context.id}
            story={story}
            number={context.number ?? 1}
            origin={location ?? context.originLocation}
            chatPending={!online || !location || !!conversation?.pending || !!conversation?.error}
            conversation={<ChatTranscript {...conversationProps} />}
            onBack={() => navigation.back({ kind: "nearby" })}
            onAsk={conversationProps.onAsk}
          />
        )
    }
    return (
      <NearbyScreen
        discovery={displayedDiscovery}
        location={location}
        radiusMeters={displayedDiscovery?.radiusMeters ?? RADIUS_METERS}
        researching={busy}
        offline={!online}
        mapProvider={research.mapProvider}
        progress={progress}
        error={error}
        locationError={locationError}
        onRetry={retry}
        onChoosePlace={query => {
          if (archivedContext) setView({ kind: "nearby" }, true)
          choosePlace(query)
        }}
        onRefresh={() => {
          if (archivedContext) setView({ kind: "nearby" }, true)
          refresh()
        }}
        savedReading={
          saved && (
            <SavedReading
              discoveries={saved.discoveries}
              conversations={saved.conversations}
              pending={!!saved.pendingDiscovery}
              onDiscovery={nearby.showSaved}
              onConversation={conversation =>
                setView({ kind: "chat", context: conversation.context })
              }
              onClear={clearHistory}
            />
          )
        }
        onOpenStory={id => {
          const index = stories.findIndex(story => story.id === id)
          if (index >= 0 && displayedDiscovery)
            setView({
              kind: "story",
              story: stories[index],
              context: conversationContext(
                displayedDiscovery.location,
                displayedDiscovery,
                stories[index],
                index + 1,
              ),
            })
        }}
        chatPending={!online || !!generalConversation?.pending || !!generalConversation?.error}
        conversation={
          generalContext && (
            <ChatTranscript
              key={generalContext.id}
              messages={generalConversation?.messages ?? []}
              answering={!!generalConversation?.pending && !generalConversation.error}
              error={generalConversation?.error}
              onRetry={() => chat.retry(generalContext.id)}
              onRestart={() => chat.retry(generalContext.id, true)}
              restartRequired={generalConversation?.restartRequired}
              offline={!online}
              questionDisabled={!location}
              suggestions={[]}
              onAsk={question => ask(question, generalContext)}
            />
          )
        }
        onAsk={question => {
          if (generalContext) ask(question, generalContext)
        }}
      />
    )
  })()

  return (
    <main className="bg-background mx-auto flex h-dvh max-w-md flex-col pt-[calc(env(safe-area-inset-top)+24px)] font-mono text-[12.5px] leading-tight text-neutral-900">
      {!online && (
        <p role="status" className="px-[18px] py-2 text-neutral-600">
          You're offline. Saved reading is available; new research and answers need a connection.
        </p>
      )}
      {(nearby.storageError || chat.storageError || clearError) && (
        <p role="alert" className="px-[18px] py-2 text-red-700">
          {clearError
            ? "Browser storage could not be cleared. Use your browser's clear-site-data controls."
            : "Changes could not be saved on this device. Keep this page open to retain them."}
        </p>
      )}
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
    coordinatesExpireAt:
      discovery?.coordinatesExpireAt ?? new Date(Date.now() + 29 * 86_400_000).toISOString(),
    promptVersion: discovery?.promptVersion ?? "ledger-4",
  }
}

const defaultResearch = createLiveResearch()

type Props = {
  /** Adapter for location and research. */
  research?: Research
  /** Explicit archive for deterministic reopen and offline tests. */
  history?: ReturnType<typeof createHistoryStore>
}
