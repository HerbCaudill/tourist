import { useCallback, useEffect, useRef, useState } from "react"
import type { Discovery, Location, Research, ResearchProgress } from "../types"
import type { createHistoryStore } from "../lib/createHistoryStore"
import { ResearchClientError } from "../lib/ResearchClientError"

/** Manage resumable discovery while preserving readable results and their original geography. */
export function useDiscovery(
  /** Fixture or live research transport. */
  research: Research,
  /** Optional validated local archive. */
  history?: ReturnType<typeof createHistoryStore>,
  /** Tell the history controls that a saved record changed. */
  onHistoryChange?: () => void,
) {
  const [location, setLocation] = useState<Location>()
  const [discovery, setDiscovery] = useState<Discovery | undefined>(
    () => history?.read().discoveries[0],
  )
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ResearchProgress>()
  const [error, setError] = useState<string>()
  const [storageError, setStorageError] = useState(false)
  const [locationError, setLocationError] = useState(false)
  const operation = useRef<Operation | undefined>(undefined)
  const active = useRef<{ location: Location; manual: boolean } | undefined>(undefined)
  const failed = useRef<FailedOperation | undefined>(undefined)

  /** Cancel client polling without canceling the durable server job. */
  const stop = useCallback(() => {
    operation.current?.controller.abort()
    operation.current = undefined
    setBusy(false)
    setProgress(undefined)
  }, [])

  /** Start a superseding operation and stop polling its predecessor. */
  const begin = useCallback((query?: string) => {
    operation.current?.controller.abort()
    const current = { query, controller: new AbortController() }
    operation.current = current
    setBusy(true)
    setError(undefined)
    setLocationError(false)
    setProgress(undefined)
    return current
  }, [])

  /** Reuse suitable research or resume the same durable request after a disconnection. */
  const discover = useCallback(
    async (
      where: Location,
      current: Operation,
      requestId: string = crypto.randomUUID(),
      reuse = false,
    ) => {
      if (!navigator.onLine) {
        stop()
        return
      }
      if (reuse && history) {
        const cached = [200, 500, 1000]
          .map(radiusMeters =>
            history.findSuitableDiscovery({
              location: where,
              radiusMeters,
              promptVersion: "ledger-2",
            }),
          )
          .find(Boolean)
        if (cached) {
          failed.current = undefined
          setError(undefined)
          setLocationError(false)
          const cleared = history.clearPendingDiscovery()
          setStorageError(previous => previous || !cleared)
          onHistoryChange?.()
          setDiscovery(cached)
          stop()
          return
        }
      }
      failed.current = { kind: "discovery", location: where, requestId }
      if (history) {
        const prior = history.read().pendingDiscovery
        const saved = history.savePendingDiscovery({
          requestId,
          location: where,
          manual: active.current?.manual ?? false,
          startedAt: prior?.requestId === requestId ? prior.startedAt : new Date().toISOString(),
        })
        setStorageError(!saved)
        onHistoryChange?.()
      }
      setProgress({ status: "queued", radiusMeters: 200 })
      try {
        const result = await research.discover(where, {
          requestId,
          signal: current.controller.signal,
          onProgress: next => {
            if (operation.current === current) setProgress(next)
          },
        })
        if (operation.current !== current) return
        if (history) {
          const saved = history.saveDiscovery(result)
          const cleared = history.clearPendingDiscovery()
          setStorageError(!saved || !cleared)
          onHistoryChange?.()
        }
        setDiscovery(result)
        failed.current = undefined
      } catch (failure) {
        if (operation.current !== current || current.controller.signal.aborted) return
        if (failure instanceof ResearchClientError && failure.restartRequired) {
          failed.current = { kind: "discovery", location: where, requestId: crypto.randomUUID() }
          if (history) {
            const cleared = history.clearPendingDiscovery()
            setStorageError(previous => previous || !cleared)
            onHistoryChange?.()
          }
        }
        setError(
          failure instanceof Error ? failure.message : "Research could not finish. Try again.",
        )
      } finally {
        if (operation.current === current) stop()
      }
    },
    [history, onHistoryChange, research, stop],
  )

  /** Resolve browser location or a typed place before selecting suitable cached research. */
  const locate = useCallback(
    async (query?: string, reuse = true) => {
      if (!navigator.onLine) return
      if (query && operation.current?.query === query) return
      const current = begin(query)
      try {
        const where = query ? await research.resolveLocation(query) : await research.locate()
        if (operation.current !== current) return
        if (!query && where.accuracyMeters > 200)
          throw new Error(
            `Location is only accurate to about ${Math.round(where.accuracyMeters)} m. Enter a street or landmark instead.`,
          )
        active.current = { location: where, manual: !!query }
        setLocation(where)
        await discover(where, current, undefined, reuse)
      } catch (failure) {
        if (operation.current !== current || current.controller.signal.aborted) return
        failed.current = { kind: "location", query }
        setError(
          failure instanceof Error
            ? failure.message
            : "Location is unavailable. Enter a place instead.",
        )
        setLocationError(true)
        stop()
      }
    },
    [begin, discover, research, stop],
  )

  /** Resume the one saved request, or refresh location while retaining any open reader. */
  const resume = useCallback(() => {
    if (!navigator.onLine || operation.current) return
    const pending = history?.read().pendingDiscovery
    if (pending) {
      active.current = { location: pending.location, manual: pending.manual ?? false }
      setLocation(pending.location)
      void discover(pending.location, begin(), pending.requestId)
    } else if (active.current?.manual) {
      void discover(active.current.location, begin(active.current.location.name), undefined, true)
    } else void locate()
  }, [begin, discover, history, locate])

  useEffect(() => {
    resume()
    const foreground = () => {
      if (document.visibilityState === "visible") resume()
    }
    window.addEventListener("online", resume)
    window.addEventListener("offline", stop)
    document.addEventListener("visibilitychange", foreground)
    return () => {
      operation.current?.controller.abort()
      operation.current = undefined
      window.removeEventListener("online", resume)
      window.removeEventListener("offline", stop)
      document.removeEventListener("visibilitychange", foreground)
    }
  }, [resume, stop])

  /** Clear displayed results and start new research even when cached reading is still fresh. */
  const refresh = () => {
    if (operation.current || !navigator.onLine) return
    setDiscovery(undefined)
    if (active.current?.manual)
      void discover(active.current.location, begin(active.current.location.name))
    else void locate(undefined, false)
  }

  /** Replay the operation that failed, retaining its original query or request ID. */
  const retry = () => {
    if (operation.current || !navigator.onLine) return
    if (failed.current?.kind === "discovery")
      void discover(failed.current.location, begin(), failed.current.requestId)
    else void locate(failed.current?.query)
  }

  /** Remove readable state and cancel pending responses so they cannot restore cleared history. */
  const clear = () => {
    stop()
    active.current = undefined
    failed.current = undefined
    setDiscovery(undefined)
    setLocation(undefined)
    setError(undefined)
    setStorageError(false)
    setLocationError(false)
  }

  return {
    location,
    discovery,
    busy,
    progress,
    error,
    storageError,
    locationError,
    refresh,
    retry,
    choosePlace: locate,
    clear,
    showSaved: setDiscovery,
  }
}

type Operation = {
  /** Typed query used to deduplicate repeated submissions. */
  query?: string
  /** Cancel local polling without canceling the persisted server job. */
  controller: AbortController
}
/** Exact operation to replay after a recoverable failure. */
type FailedOperation =
  | { kind: "location"; query?: string }
  | { kind: "discovery"; location: Location; requestId: string }
