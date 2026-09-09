import { useCallback, useEffect, useRef, useState } from "react"
import type { Discovery, Location, Research, ResearchProgress } from "../types"

/** Manage location and discovery without replacing readable results during an update. */
export function useDiscovery(
  /** Fixture or live research transport. */
  research: Research,
) {
  const [location, setLocation] = useState<Location>()
  const [discovery, setDiscovery] = useState<Discovery>()
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<ResearchProgress>()
  const [error, setError] = useState<string>()
  const [locationError, setLocationError] = useState(false)
  const operation = useRef<Operation | undefined>(undefined)
  const active = useRef<{ location: Location; manual: boolean } | undefined>(undefined)
  const failed = useRef<FailedOperation | undefined>(undefined)

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

  /** Research a resolved location, keeping its request ID if a connection failed. */
  const discover = useCallback(
    async (where: Location, current: Operation, requestId: string = crypto.randomUUID()) => {
      failed.current = { kind: "discovery", location: where, requestId }
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
        setDiscovery(result)
        failed.current = undefined
      } catch (failure) {
        if (operation.current !== current || current.controller.signal.aborted) return
        setError(
          failure instanceof Error ? failure.message : "Research could not finish. Try again.",
        )
      } finally {
        if (operation.current === current) {
          operation.current = undefined
          setBusy(false)
          setProgress(undefined)
        }
      }
    },
    [research],
  )

  /** Resolve a browser location or the user's explicit place choice. */
  const locate = useCallback(
    async (query?: string) => {
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
        await discover(where, current)
      } catch (failure) {
        if (operation.current !== current || current.controller.signal.aborted) return
        failed.current = { kind: "location", query }
        setError(
          failure instanceof Error
            ? failure.message
            : "Location is unavailable. Enter a place instead.",
        )
        setLocationError(true)
        setBusy(false)
        operation.current = undefined
      }
    },
    [begin, discover, research],
  )

  useEffect(() => {
    void locate()
    return () => {
      operation.current?.controller.abort()
      operation.current = undefined
    }
  }, [locate])

  /** Refresh GPS before new research, or retain an explicitly chosen place. */
  const refresh = () => {
    if (operation.current) return
    if (active.current?.manual)
      void discover(active.current.location, begin(active.current.location.name))
    else void locate()
  }

  /** Reconnect to the interrupted research or retry browser location. */
  const retry = () => {
    if (operation.current) return
    if (failed.current?.kind === "discovery")
      void discover(failed.current.location, begin(), failed.current.requestId)
    else void locate(failed.current?.query)
  }

  return {
    location,
    discovery,
    busy,
    progress,
    error,
    locationError,
    refresh,
    retry,
    choosePlace: locate,
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
