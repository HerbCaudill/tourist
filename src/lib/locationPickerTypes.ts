import type { Coordinates, Location } from "../types"

/** Search context derived from the visible map. */
export type PickerViewport = {
  /** Map center, independent of the device position. */
  center: Coordinates
  /** Soft search bias, bounded by Google's 50 km limit. */
  radiusMeters: number
}

/** A temporary suggestion; provider details never enter the reading archive. */
export type PlaceSuggestion = {
  /** Stable provider identifier for keyboard navigation. */
  id: string
  /** Primary display label. */
  name: string
  /** Geographic context to distinguish similarly named places. */
  address: string
  /** Resolve only the chosen result, completing its autocomplete session. */
  resolve: () => Promise<Location>
}

/** Small imperative boundary around the provider's interactive map. */
export type PickerMap = {
  /** Preview a chosen result or device position. */
  center: (location: Location) => void
  /** Show the device position independently of the center pin. */
  setGps: (location: Location) => void
  /** Remove listeners and provider elements when the picker closes. */
  destroy: () => void
}

/** Provider operations kept separate from selection and confirmation state. */
export type LocationPickerServices = {
  /** Mount an interactive map and report movement and settled viewports. */
  mount: (
    element: HTMLElement,
    initial: Location | undefined,
    onMove: () => void,
    onIdle: (viewport: PickerViewport) => void,
    signal: AbortSignal,
  ) => Promise<PickerMap>
  /** Find predictions near the viewed area without restricting distant matches. */
  suggest: (query: string, viewport?: PickerViewport) => Promise<PlaceSuggestion[]>
  /** Look up a temporary label without snapping the selected coordinates to an address. */
  describe: (coordinates: Coordinates) => Promise<string>
}
