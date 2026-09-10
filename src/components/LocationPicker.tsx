import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import {
  IconCurrentLocation,
  IconMapPin,
  IconMapPinFilled,
  IconCircleCheckFilled,
  IconX,
} from "@tabler/icons-react"
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
    searchContainer,
    onEditingChange,
    children,
    services: suppliedServices,
    offline,
  }: Props,
) {
  const [services] = useState(() => suppliedServices ?? createGoogleLocationPicker())
  const [draft, setDraft] = useState(initial)
  const draftRef = useRef(initial)
  const [label, setLabel] = useState(initial?.name ?? "Choose a spot on the map")
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [mapActive, setMapActive] = useState(false)
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
  const returningFocus = useRef(false)

  useEffect(() => {
    onEditingChange?.(mapActive)
  }, [mapActive, onEditingChange])

  useEffect(() => {
    if (mapActive) return
    initialRef.current = initial
    draftRef.current = initial
    gps.current = deviceLocation
    setDraft(initial)
    setLabel(initial?.name ?? "Choose a spot on the map")
    setViewport(initial ? { center: initial.coordinates, radiusMeters: 5000 } : undefined)
  }, [initial, deviceLocation, mapActive])

  useEffect(() => {
    if (!element) return
    element.focus()
    setMapReady(false)
    setMapError(undefined)
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
    setSearchOpen(true)
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
    setMapActive(true)
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
      setSearchOpen(false)
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

  /** Finish editing and return focus to the original inline location field. */
  function closePicker() {
    revision.current += 1
    setMapActive(false)
    setQuery("")
    setSearchOpen(false)
    setPending(false)
    setError(undefined)
    returningFocus.current = document.activeElement !== input.current
    input.current?.focus()
  }

  let suggestionMessage = "No suggestions. Try adding a city, or choose on the map."
  if (searching) suggestionMessage = "Finding places…"
  else if (searchError)
    suggestionMessage = "Suggestions unavailable. Press Search to look up the place."

  const searchControl = (
    <div
      className="relative min-w-0 flex-1"
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget)) setSearchOpen(false)
      }}
    >
      <form
        className="flex min-w-0 items-center gap-1"
        onSubmit={event => {
          event.preventDefault()
          if (pending || offline || !query.trim()) return
          const suggestion = suggestions[highlighted >= 0 ? highlighted : 0]
          if (suggestion) void preview(suggestion.resolve, suggestion.name)
          else void preview(() => resolveLocation(query.trim()))
        }}
      >
        <span className="relative h-[1.25em] min-w-0 flex-1">
          <input
            ref={input}
            role="combobox"
            aria-label="Search for a place"
            aria-autocomplete="list"
            aria-expanded={searchOpen}
            aria-controls="location-suggestions"
            aria-activedescendant={highlighted >= 0 ? `location-option-${highlighted}` : undefined}
            placeholder={initial?.name.toLowerCase() ?? "choose a place"}
            value={query}
            maxLength={200}
            autoComplete="off"
            disabled={offline}
            onFocus={() => {
              if (returningFocus.current) returningFocus.current = false
              else setSearchOpen(true)
            }}
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
              if (event.key === "Escape") {
                event.preventDefault()
                event.stopPropagation()
                if (searchOpen || query) {
                  changeQuery("")
                  setSearchOpen(false)
                } else {
                  closePicker()
                  onCancel?.()
                }
              }
            }}
            className="absolute top-0 left-0 w-[128%] origin-top-left scale-[0.78125] bg-transparent text-[16px] leading-tight outline-none placeholder:text-neutral-500 focus:border-b focus:border-neutral-400"
          />
        </span>
        {query && (
          <>
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => changeQuery("")}
              className="text-neutral-500"
            >
              <IconX size={14} />
            </button>
            <button
              type="submit"
              aria-label="Search"
              disabled={pending || offline}
              className="text-red-700 disabled:text-neutral-400"
            >
              <IconCircleCheckFilled size={16} />
            </button>
          </>
        )}
      </form>
      {searchOpen && (
        <div className="bg-background absolute top-full right-0 left-0 z-30 mt-2 max-h-[45dvh] overflow-y-auto border border-neutral-400 text-[12.5px] leading-normal">
          <button
            type="button"
            disabled={offline}
            onClick={() => {
              changeQuery("")
              setSearchOpen(false)
              input.current?.blur()
              setMapActive(true)
              if (element) element.focus()
            }}
            className="flex min-h-10 w-full items-center gap-2 border-b border-neutral-300 px-2 py-2 text-left text-red-700 hover:bg-neutral-200 disabled:text-neutral-400"
          >
            <IconMapPin size={14} aria-hidden="true" />
            Choose on map
          </button>
          <button
            type="button"
            disabled={pending || offline}
            onClick={() => void preview(locate, "Your current location", true)}
            className="flex min-h-10 w-full items-center gap-2 border-b border-neutral-300 px-2 py-2 text-left text-red-700 hover:bg-neutral-200 disabled:text-neutral-400"
          >
            <IconCurrentLocation size={14} aria-hidden="true" />
            Use my current location
          </button>
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
                  "cursor-pointer border-b border-neutral-300 px-2 py-2 hover:bg-neutral-200",
                  highlighted === index && "bg-neutral-200",
                )}
              >
                <p>{suggestion.name}</p>
                <p className="mt-0.5 text-[11px] text-neutral-500">{suggestion.address}</p>
              </li>
            ))}
          </ul>
          {query.trim().length >= 2 && suggestions.length === 0 && (
            <p role="status" className="px-2 py-2 text-[11px] text-neutral-500">
              {suggestionMessage}
            </p>
          )}
          {query.trim().length >= 2 && (
            <p className="px-2 py-1 text-[10px] text-neutral-500">Google Maps</p>
          )}
        </div>
      )}
    </div>
  )

  return (
    <>
      {searchContainer ? createPortal(searchControl, searchContainer) : searchControl}
      {mapActive ? (
        <section
          id="location-picker"
          aria-label="Choose a location"
          onKeyDown={event => {
            if (event.key === "Escape") {
              closePicker()
              onCancel?.()
            }
          }}
        >
          <div className="relative aspect-[640/420] max-h-[40dvh] min-h-32 w-full bg-neutral-200">
            <div
              ref={setElement}
              tabIndex={-1}
              aria-label="Location map"
              className="absolute inset-0 outline-none"
            />
            {mapReady && (
              <>
                <div className="pointer-events-none absolute inset-x-2 top-2 flex justify-center">
                  <p className="bg-background/95 px-2 py-1 text-[11px]">
                    Move the map to choose a spot
                  </p>
                </div>
                <IconMapPinFilled
                  aria-hidden="true"
                  size={32}
                  viewBox="0 0 24 22"
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-full text-red-700"
                />
              </>
            )}
            {!mapReady && (
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center p-5 text-center text-neutral-500"
              >
                {mapError ?? "Loading map…"}
              </p>
            )}
          </div>
          <div className="border-b border-neutral-300 px-[18px] py-2">
            <div className="flex items-center gap-3">
              <div className="min-w-0 flex-1">
                <p aria-live="polite" className="truncate">
                  {moving ? "Choosing a spot…" : label}
                </p>
                {draft && (
                  <p className="mt-0.5 text-[10px] text-neutral-500">
                    {draft.coordinates.lat.toFixed(5)}, {draft.coordinates.lon.toFixed(5)}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => {
                  closePicker()
                  onCancel?.()
                }}
                className="min-h-9 text-neutral-500"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!draft || moving || pending || offline || !!query.trim()}
                onClick={() => {
                  if (draft) {
                    closePicker()
                    onConfirm(draft)
                  }
                }}
                className="flex min-h-9 shrink-0 items-center gap-1 text-red-700 disabled:text-neutral-400"
              >
                <IconCircleCheckFilled size={16} aria-hidden="true" />
                {pending ? "Finding location…" : "Explore here"}
              </button>
            </div>
            {draft && draft.accuracyMeters > 200 && (
              <p className="mt-2 text-[11px] text-neutral-500">
                GPS accuracy about {Math.round(draft.accuracyMeters)} m; adjust the pin for
                precision.
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
          </div>
        </section>
      ) : (
        children
      )}
    </>
  )
}

type Props = {
  /** Active exploration origin; never assumed to be the device position. */
  initial?: Location
  /** Last observed GPS position, shown separately from the pin. */
  deviceLocation?: Location
  /** Header slot for the original inline location field. */
  searchContainer?: HTMLElement | null
  /** Existing reading map, shown until a position is being chosen. */
  children?: ReactNode
  /** Inform the reading screen when map selection begins or ends. */
  onEditingChange?: (editing: boolean) => void
  /** Fresh browser GPS lookup, only on explicit request. */
  locate: () => Promise<Location>
  /** Typed lookup remains available if autocomplete fails. */
  resolveLocation: (query: string) => Promise<Location>
  /** Commit one fully resolved position. */
  onConfirm: (location: Location) => void
  /** Discard the tentative selection. */
  onCancel?: () => void
  /** Injectable provider for deterministic behavioral tests. */
  services?: LocationPickerServices
  /** Disable operations while the connection is unavailable. */
  offline?: boolean
}
