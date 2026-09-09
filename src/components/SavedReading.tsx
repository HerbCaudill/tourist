import type { Conversation, Discovery } from "../types"

/** Offer saved discoveries and complete conversations without fetching new research. */
export function SavedReading(
  /** Retained records and navigation actions. */
  {
    discoveries,
    conversations,
    pending,
    onDiscovery,
    onConversation,
    onClear,
  }: Props,
) {
  if (discoveries.length === 0 && conversations.length === 0 && !pending) return null
  return (
    <details className="mb-2 border-t border-neutral-300 pt-2 text-neutral-600">
      <summary className="cursor-pointer">Saved reading</summary>
      <div className="max-h-52 overflow-y-auto py-2">
        {discoveries.map(discovery => (
          <button
            key={`${discovery.researchedAt.toISOString()}/${discovery.location.name}`}
            type="button"
            onClick={() => onDiscovery(discovery)}
            className="mb-2 block w-full text-left hover:text-red-700"
          >
            Stories near {discovery.location.name} · {discovery.researchedAt.toLocaleDateString()}
          </button>
        ))}
        {conversations.map(conversation => (
          <button
            key={conversation.id}
            type="button"
            onClick={() => onConversation(conversation)}
            className="mb-2 block w-full text-left hover:text-red-700"
          >
            Conversation:{" "}
            {conversation.context.stories.find(
              story => story.id === conversation.context.selectedStoryId,
            )?.title ?? conversation.context.originLocation.name}
            {conversation.pending ? " · answer pending" : ""}
          </button>
        ))}
        <button type="button" onClick={onClear} className="mt-1 text-red-700 underline">
          Clear history
        </button>
      </div>
    </details>
  )
}

type Props = {
  /** Retained discoveries, including older offline reading. */
  discoveries: Discovery[]
  /** Retained conversations. */
  conversations: Conversation[]
  /** A discovery request awaiting reconnection can also be cleared. */
  pending?: boolean
  /** Show an existing discovery without researching again. */
  onDiscovery: (discovery: Discovery) => void
  /** Open a complete originating conversation snapshot. */
  onConversation: (conversation: Conversation) => void
  /** Erase local reading history. */
  onClear: () => void
}
