import { importLibrary, setOptions } from "@googlemaps/js-api-loader"
import { distanceBetween } from "./distanceBetween"
import type { LocationPickerServices } from "./locationPickerTypes"
import type { Coordinates, Location } from "../types"

/** Load Google only when the picker needs it, with a separate website-restricted key. */
export function createGoogleLocationPicker(): LocationPickerServices {
  let session: google.maps.places.AutocompleteSessionToken | undefined
  /** Fail clearly before loading the SDK when local configuration is missing. */
  async function load() {
    const key = import.meta.env.VITE_GOOGLE_MAPS_BROWSER_KEY
    if (!key)
      throw new Error("The interactive map is unavailable. You can still search for a place.")
    if (!configured) {
      setOptions({ key, v: "quarterly", authReferrerPolicy: "origin" })
      configured = true
    }
    return importLibrary("maps")
  }
  return {
    /** Mount only while the requesting picker is still open. */
    async mount(element, initial, onMove, onIdle, signal) {
      const { Map, Circle } = await load()
      signal.throwIfAborted()
      const map = new Map(element, {
        center: initial ? point(initial.coordinates) : { lat: 20, lng: 0 },
        zoom: initial ? 16 : 2,
        disableDefaultUI: true,
        zoomControl: true,
        keyboardShortcuts: true,
        gestureHandling: "greedy",
        clickableIcons: false,
        styles: [{ stylers: [{ saturation: -75 }] }],
      })
      let gps: google.maps.Circle | undefined
      let accuracy: google.maps.Circle | undefined
      let ready = false
      /** Keep the blue dot visible at every zoom while its accuracy circle stays in meters. */
      function gpsRadius() {
        return (
          (5 * 156543.03392 * Math.cos(((gps?.getCenter()?.lat() ?? 0) * Math.PI) / 180)) /
          2 ** (map.getZoom() ?? 16)
        )
      }
      const listeners = [
        map.addListener("bounds_changed", () => {
          if (ready) onMove()
        }),
        map.addListener("zoom_changed", () => gps?.setRadius(gpsRadius())),
        map.addListener("idle", () => {
          ready = true
          const center = map.getCenter()
          if (!center) return
          const coordinates = { lat: center.lat(), lon: center.lng() }
          const corner = map.getBounds()?.getNorthEast()
          onIdle({
            center: coordinates,
            radiusMeters: corner
              ? Math.min(
                  50_000,
                  Math.max(
                    200,
                    distanceBetween(coordinates, { lat: corner.lat(), lon: corner.lng() }),
                  ),
                )
              : 5000,
          })
        }),
      ]
      return {
        /** Center a preview at street scale for precise adjustment. */
        center(location) {
          map.setCenter(point(location.coordinates))
          map.setZoom(16)
        },
        /** Keep the device dot and its uncertainty separate from the selection. */
        setGps(location) {
          gps?.setMap(null)
          accuracy?.setMap(null)
          accuracy = new Circle({
            map,
            center: point(location.coordinates),
            radius: location.accuracyMeters,
            fillColor: "#2563eb",
            fillOpacity: 0.1,
            strokeOpacity: 0,
            clickable: false,
          })
          gps = new Circle({
            map,
            center: point(location.coordinates),
            radius: 3,
            fillColor: "#2563eb",
            fillOpacity: 1,
            strokeColor: "#ffffff",
            strokeWeight: 2,
            clickable: false,
          })
          gps.setRadius(gpsRadius())
        },
        /** Release event handlers and overlays owned by this picker. */
        destroy() {
          listeners.forEach(listener => listener.remove())
          gps?.setMap(null)
          accuracy?.setMap(null)
          element.replaceChildren()
        },
      }
    },
    /** Use one autocomplete session per selection, biased to the viewed area. */
    async suggest(query, viewport) {
      await load()
      const { AutocompleteSuggestion, AutocompleteSessionToken } = await importLibrary("places")
      session ??= new AutocompleteSessionToken()
      const { suggestions } = await AutocompleteSuggestion.fetchAutocompleteSuggestions({
        input: query,
        sessionToken: session,
        ...(viewport
          ? { locationBias: { center: point(viewport.center), radius: viewport.radiusMeters } }
          : {}),
      })
      return suggestions.flatMap(({ placePrediction }) => {
        if (!placePrediction) return []
        return [
          {
            id: placePrediction.placeId,
            name: placePrediction.mainText?.toString() ?? placePrediction.text.toString(),
            address: placePrediction.secondaryText?.toString() ?? "",
            /** Fetch coordinates only and terminate the autocomplete session. */
            async resolve(): Promise<Location> {
              const place = placePrediction.toPlace()
              session = undefined
              await place.fetchFields({ fields: ["location"] })
              if (!place.location)
                throw new Error("That place could not be located. Try another result.")
              // Retain the user's query, while Google's display labels stay inside the picker.
              return {
                name: query.trim(),
                area: "",
                coordinates: { lat: place.location.lat(), lon: place.location.lng() },
                accuracyMeters: 0,
              }
            },
          },
        ]
      })
    },
    /** Describe the pin without replacing its precise position with a nearby address. */
    async describe(coordinates) {
      await load()
      const { Geocoder } = await importLibrary("geocoding")
      const { results } = await new Geocoder().geocode({ location: point(coordinates) })
      return results[0]?.formatted_address ?? "Dropped pin"
    },
  }
}

/** Translate application coordinates at the SDK boundary. */
function point(
  /** Latitude and longitude in the app's naming convention. */
  coordinates: Coordinates,
) {
  return { lat: coordinates.lat, lng: coordinates.lon }
}

let configured = false
