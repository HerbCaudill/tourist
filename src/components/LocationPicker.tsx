import { useEffect, useRef, useState } from "react"
import { Dialog } from "@base-ui/react/dialog"
import { IconCurrentLocation, IconMapPinFilled, IconSearch, IconX } from "@tabler/icons-react"
import { cn } from "cn"
import { createGoogleLocationPicker } from "../lib/createGoogleLocationPicker"
import { distanceBetween } from "../lib/distanceBetween"
import type {
  LocationPickerServices,
  PickerMap,
  PickerViewport,
  PlaceSuggestion,
} from "../lib/locationPickerTypes"
import type { Location } from "../types"

/** Preview a search or map position without changing the active discovery until confirmation. */
export function LocationPicker(
  /** Starting position, provider boundary, and explicit completion actions. */
  {
    initial,
    deviceLocation,
    locate,
    resolveLocation,
    onConfirm,
    onCancel,
    services: suppliedServices,
    offline,
  }: Props,
) {
  const [services] = useState(() => suppliedServices ?? createGoogleLocationPicker())
  const [draft, setDraft] = useState(initial)
  const draftRef = useRef(initial)
  const [label, setLabel] = useState(initial?.name ?? "Choose a spot on the map")
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([])
  const [highlighted, setHighlighted] = useState(-1)
  const [viewport, setViewport] = useState<PickerViewport | undefined>(
    initial ? { center: initial.coordinates, radiusMeters: 5000 } : undefined,
  )
  const [moving, setMoving] = useState(false)
  const [pending, setPending] = useState(false)
  const [searching, setSearching] = useState(false)
  const [mapReady, setMapReady] = useState(false)
  const [mapError, setMapError] = useState<string>()
  const [error, setError] = useState<string>()
  const [searchError, setSearchError] = useState(false)
  const [element, setElement] = useState<HTMLDivElement | null>(null)
  const map = useRef<PickerMap | undefined>(undefined)
  const gps = useRef(deviceLocation)
  const input = useRef<HTMLInputElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const revision = useRef(0)
  const searchRevision = useRef(0)
  const initialRef = useRef(initial)

  useEffect(() => {
    if (!element) return
    let active = true
    let firstIdle = true
    const controller = new AbortController()
    let mounted: PickerMap | undefined
    void services
      .mount(
        element,
        initialRef.current,
        () => {
          if (!active) return
          revision.current += 1
          setMoving(true)
          setPending(false)
        },
        next => {
          if (!active) return
          setMoving(false)
          setViewport(next)
          const initialView = firstIdle
          firstIdle = false
          if (initialView && !draftRef.current) return
          // Programmatic centering and zoom-only changes preserve the selected place label.
          if (draftRef.current && distanceBetween(draftRef.current.coordinates, next.center) < 0.5)
            return
          const where: Location = {
            name: "Dropped pin",
            area: "",
            coordinates: next.center,
            accuracyMeters: 0,
          }
          draftRef.current = where
          setDraft(where)
          setLabel("Dropped pin")
          const current = ++revision.current
          void services
            .describe(next.center)
            .then(address => {
              if (active && revision.current === current) setLabel(address)
            })
            .catch(() => {
              /* Coordinates remain selectable when an address is unavailable. */
            })
        },
        controller.signal,
      )
      .then(value => {
        mounted = value
        if (!active) return value.destroy()
        map.current = value
        if (draftRef.current && draftRef.current !== initialRef.current)
          value.center(draftRef.current)
        if (gps.current) value.setGps(gps.current)
        setMapReady(true)
      })
      .catch(() => {
        if (active)
          setMapError(
            "The map could not load. You can still search for a place or use your current location.",
          )
      })
    return () => {
      active = false
      controller.abort()
      revision.current += 1
      searchRevision.current += 1
      mounted?.destroy()
      map.current = undefined
    }
  }, [services, element])

  useEffect(() => {
    const current = ++searchRevision.current
    setSuggestions([])
    setHighlighted(-1)
    setSearchError(false)
    if (query.trim().length < 2 || offline) {
      setSearching(false)
      return
    }
    setSearching(true)
    const timer = setTimeout(() => {
      void services
        .suggest(query.trim(), viewport)
        .then(results => {
          if (searchRevision.current === current) setSuggestions(results)
        })
        .catch(() => {
          if (searchRevision.current === current) setSearchError(true)
        })
        .finally(() => {
          if (searchRevision.current === current) setSearching(false)
        })
    }, 250)
    return () => {
      clearTimeout(timer)
      searchRevision.current += 1
    }
  }, [query, services, viewport, offline])

  useEffect(() => {
    if (highlighted >= 0)
      list.current?.children.item(highlighted)?.scrollIntoView?.({ block: "nearest" })
  }, [highlighted])

  /** Invalidate pending detail lookups when the user changes their intent. */
  function changeQuery(
    /** Latest search text, including an explicit clear. */
    value: string,
  ) {
    revision.current += 1
    searchRevision.current += 1
    setPending(false)
    setError(undefined)
    setSuggestions([])
    setHighlighted(-1)
    setQuery(value)
  }

  /** Resolve a tentative position, guarding against late results after newer interactions. */
  async function preview(
    /** Resolve the user's latest selected suggestion, typed query, or GPS request. */
    getLocation: () => Promise<Location>,
    /** Temporary display label for this selection. */
    displayName?: string,
    /** Whether this result also updates the independent GPS dot. */
    device = false,
  ) {
    const current = ++revision.current
    searchRevision.current += 1
    setSuggestions([])
    setPending(true)
    setError(undefined)
    try {
      const where = await getLocation()
      if (revision.current !== current) return
      draftRef.current = where
      setDraft(where)
      setLabel(displayName ?? where.name)
      setQuery("")
      setSearching(false)
      input.current?.blur()
      if (device) {
        gps.current = where
        map.current?.setGps(where)
      }
      map.current?.center(where)
      setViewport({ center: where.coordinates, radiusMeters: 5000 })
    } catch (failure) {
      if (revision.current === current)
        setError(
          failure instanceof Error ? failure.message : "That location is unavailable. Try again.",
        )
    } finally {
      if (revision.current === current) setPending(false)
    }
  }

  let suggestionMessage = "No suggestions. Try adding a city, or choose on the map."
  if (searching) suggestionMessage = "Finding places…"
  else if (searchError)
    suggestionMessage = "Suggestions unavailable. Press Search to look up the place."

  return (
    <Dialog.Root
      open
      onOpenChange={open => {
        if (!open) onCancel()
      }}
    >
      <Dialog.Portal>
        <Dialog.Backdrop className="fixed inset-0 z-40 bg-black/30" />
        <Dialog.Popup className="bg-background fixed inset-0 z-50 flex min-h-0 flex-col font-mono text-sm outline-none sm:inset-x-6 sm:inset-y-8 sm:mx-auto sm:max-w-2xl sm:overflow-hidden sm:rounded-xl sm:shadow-xl">
          <div className="flex shrink-0 items-center justify-between border-b border-neutral-300 px-5 pt-[max(12px,env(safe-area-inset-top))] pb-3">
            <Dialog.Title className="font-semibold">Choose a location</Dialog.Title>
            <Dialog.Close className="min-h-11 px-2 text-red-700">Cancel</Dialog.Close>
          </div>
          <div className="relative z-10 shrink-0 px-5 pt-4 pb-3">
            <form
              onSubmit={event => {
                event.preventDefault()
                if (pending || offline || !query.trim()) return
                const suggestion = suggestions[highlighted >= 0 ? highlighted : 0]
                if (suggestion) void preview(suggestion.resolve, suggestion.name)
                else void preview(() => resolveLocation(query.trim()))
              }}
              className="flex items-center gap-2 rounded-lg border border-neutral-400 bg-white px-3 focus-within:ring-2 focus-within:ring-red-700"
            >
              <IconSearch size={18} aria-hidden="true" />
              <input
                ref={input}
                role="combobox"
                aria-label="Search for a place"
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                aria-controls="location-suggestions"
                aria-activedescendant={
                  highlighted >= 0 ? `location-option-${highlighted}` : undefined
                }
                placeholder="Place, street, or city"
                value={query}
                maxLength={200}
                autoComplete="off"
                disabled={offline}
                onChange={event => changeQuery(event.target.value)}
                onKeyDown={event => {
                  if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                    event.preventDefault()
                    const direction = event.key === "ArrowDown" ? 1 : -1
                    setHighlighted(index => {
                      if (!suggestions.length) return -1
                      if (index < 0) return direction > 0 ? 0 : suggestions.length - 1
                      return (index + direction + suggestions.length) % suggestions.length
                    })
                  }
                  if (event.key === "Escape" && query) {
                    event.preventDefault()
                    event.stopPropagation()
                    changeQuery("")
                  }
                }}
                className="min-w-0 flex-1 py-3 text-base outline-none"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => changeQuery("")}
                  className="min-h-11 px-1"
                >
                  <IconX size={18} />
                </button>
              )}
              <button
                type="submit"
                disabled={pending || offline || !query.trim()}
                className="min-h-11 text-red-700 disabled:text-neutral-400"
              >
                Search
              </button>
            </form>
            {query.trim().length >= 2 && (
              <div className="absolute inset-x-5 top-[72px] max-h-[35dvh] overflow-y-auto rounded-b-lg border border-neutral-300 bg-white shadow-lg">
                <ul ref={list} id="location-suggestions" role="listbox" aria-label="Places">
                  {suggestions.map((suggestion, index) => (
                    <li
                      key={suggestion.id}
                      id={`location-option-${index}`}
                      role="option"
                      aria-selected={highlighted === index}
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        if (!offline) void preview(suggestion.resolve, suggestion.name)
                      }}
                      className={cn(
                        "cursor-pointer border-b border-neutral-200 px-4 py-3 hover:bg-neutral-100",
                        highlighted === index && "bg-neutral-100",
                      )}
                    >
                      <p className="font-sans text-base font-medium">{suggestion.name}</p>
                      <p className="mt-1 text-xs text-neutral-500">{suggestion.address}</p>
                    </li>
                  ))}
                </ul>
                {suggestions.length === 0 && (
                  <p role="status" className="px-4 py-3 text-xs text-neutral-600">
                    {suggestionMessage}
                  </p>
                )}
                <p className="px-4 py-2 font-sans text-xs text-neutral-500">Google Maps</p>
              </div>
            )}
            <button
              type="button"
              disabled={pending || offline}
              onClick={() => void preview(locate, "Your current location", true)}
              className="mt-2 flex min-h-11 items-center gap-2 text-red-700 disabled:text-neutral-400"
            >
              <IconCurrentLocation size={18} />
              Use my current location
            </button>
          </div>
          <div className="relative min-h-32 flex-1 bg-neutral-200">
            <div ref={setElement} aria-label="Location map" className="absolute inset-0" />
            {mapReady && (
              <>
                <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
                  <p className="rounded-full bg-white/95 px-3 py-2 text-center text-xs shadow-sm">
                    Move the map to choose a spot
                  </p>
                </div>
                <IconMapPinFilled
                  aria-hidden="true"
                  size={40}
                  viewBox="0 0 24 22"
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-red-700 drop-shadow-md"
                />
              </>
            )}
            {!mapReady && (
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center p-8 text-center text-neutral-600"
              >
                {mapError ?? "Loading map…"}
              </p>
            )}
          </div>
          <div className="shrink-0 border-t border-neutral-300 px-5 pt-4 pb-[max(20px,env(safe-area-inset-bottom))]">
            <p className="text-xs text-neutral-500">Explore around</p>
            <p aria-live="polite" className="mt-1 truncate font-sans text-lg font-medium">
              {moving ? "Choosing a spot…" : label}
            </p>
            {draft && (
              <p className="mt-1 text-xs text-neutral-500">
                {draft.coordinates.lat.toFixed(5)}, {draft.coordinates.lon.toFixed(5)}
                {draft.accuracyMeters > 200
                  ? ` · GPS accuracy about ${Math.round(draft.accuracyMeters)} m; adjust the pin for precision`
                  : ""}
              </p>
            )}
            {error && (
              <p role="alert" className="mt-2 text-red-700">
                {error}
              </p>
            )}
            {offline && (
              <p role="alert" className="mt-2 text-red-700">
                You’re offline. Reconnect to explore a new location.
              </p>
            )}
            <button
              type="button"
              disabled={!draft || moving || pending || offline || !!query.trim()}
              onClick={() => {
                if (draft) onConfirm(draft)
              }}
              className="mt-4 min-h-12 w-full rounded-lg bg-red-700 px-4 py-3 font-semibold text-white disabled:bg-neutral-300 disabled:text-neutral-500"
            >
              {pending ? "Finding location…" : "Explore here"}
            </button>
          </div>
        </Dialog.Popup>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type Props = {
  /** Active exploration origin; never assumed to be the device position. */
  initial?: Location
  /** Last observed GPS position, shown as a blue dot independently of the pin. */
  deviceLocation?: Location
  /** Fresh browser GPS lookup, only on explicit request. */
  locate: () => Promise<Location>
  /** Existing text lookup remains available if the map provider fails. */
  resolveLocation: (query: string) => Promise<Location>
  /** Commit one fully resolved position. */
  onConfirm: (location: Location) => void
  /** Discard the tentative selection. */
  onCancel: () => void
  /** Injectable provider for deterministic behavioral tests. */
  services?: LocationPickerServices
  /** Disable operations while the connection is unavailable. */
  offline?: boolean
}
