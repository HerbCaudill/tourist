import { useEffect, useState } from "react"
import type { ConversationContext, Story } from "../types"

/** Keep screens in browser history and resolve direct links from available saved context. */
export function useNavigation(
  /** Current discoveries and conversations that can restore a URL. */
  contexts: ConversationContext[],
) {
  const [path, setPath] = useState(() => window.location.pathname)
  const [visited, setVisited] = useState<Record<string, View>>({})
  useEffect(() => {
    /** Follow browser back and forward without creating another history entry. */
    const pop = () => setPath(window.location.pathname)
    window.addEventListener("popstate", pop)
    return () => window.removeEventListener("popstate", pop)
  }, [])

  /** Open a screen once, keeping its original context available for this session. */
  const navigate = (view: View, replace = false) => {
    const next = viewPath(view)
    setVisited(previous => ({ ...previous, [next]: view }))
    if (next === window.location.pathname) return
    const url = next + window.location.search
    if (replace) window.history.replaceState(null, "", url)
    else window.history.pushState({ touristParent: window.location.pathname }, "", url)
    setPath(next)
  }

  /** Use the existing parent entry when possible, including after a reload. */
  const back = (parent: View) => {
    if (window.history.state?.touristParent === viewPath(parent)) window.history.back()
    else navigate(parent, true)
  }

  /** Forget in-memory snapshots when the user clears saved reading. */
  const clear = () => {
    setVisited({})
    window.history.replaceState(null, "", "/" + window.location.search)
    setPath("/")
  }

  const available: View[] = contexts.flatMap(context => {
    const story = context.stories.find(item => item.id === context.selectedStoryId)
    return [
      { kind: "chat", context },
      ...(story ? [{ kind: "story" as const, story, context }] : []),
    ]
  })
  const view: View | undefined =
    path === "/"
      ? { kind: "nearby" }
      : (visited[path] ?? available.find(candidate => viewPath(candidate) === path))
  return { view, navigate, back, clear }
}

/** Identify a context snapshot without placing its geographic coordinates in the URL. */
function viewPath(
  /** Screen and the discovery snapshot it belongs to. */
  view: View,
) {
  if (view.kind === "nearby") return "/"
  const snapshot = encodeURIComponent(view.context.researchedAt)
  const story = encodeURIComponent(view.context.selectedStoryId ?? "general")
  return `/${view.context.selectedStoryId ? "stories" : "chats"}/${snapshot}/${story}`
}

/** A screen with its original research context. */
export type View =
  | { kind: "nearby" }
  | { kind: "story"; story: Story; context: ConversationContext }
  | { kind: "chat"; context: ConversationContext }
