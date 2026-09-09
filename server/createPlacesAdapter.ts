import { Schema } from "effect"
import { Coordinates } from "../src/research/contracts.ts"
import { distanceBetween } from "../src/lib/distanceBetween.ts"
import { decode } from "./decode.ts"
import { fetchProvider } from "./fetchProvider.ts"
import { readProviderJson } from "./readProviderJson.ts"
import { readBoundedBody } from "./readBoundedBody.ts"
import { ResearchError } from "./ResearchError.ts"
import type { PlacesAdapter } from "./types.ts"

/** Narrow Google adapter: bounded anchors, typed fallback and attributed maps, with no raw content returned. */
export function createPlacesAdapter(
  /** Private Google Maps key, never prefixed VITE_. */
  key: string,
  /** Injectable transport. */
  transport: typeof fetch = fetch,
): PlacesAdapter {
  if (!key) throw new ResearchError("unavailable")
  return {
    /** Preserve the user's query as the label and use provider geometry only. */
    async resolve(query) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
      url.search = new URLSearchParams({ address: query, key }).toString()
      const response = await fetchProvider(url, {}, transport)
      const data = Schema.decodeUnknownOption(Geocoding)(await readProviderJson(response))
      if (data._tag === "None") throw new ResearchError("malformed")
      if (data.value.status === "ZERO_RESULTS") throw new ResearchError("location_not_found")
      if (data.value.status === "REQUEST_DENIED") throw new ResearchError("auth")
      if (data.value.status === "OVER_QUERY_LIMIT") throw new ResearchError("busy")
      if (data.value.status !== "OK") throw new ResearchError("unavailable")
      const result = data.value.results[0]
      if (!result || result.partial_match) throw new ResearchError("location_not_found")
      const coordinates = point(result.geometry.location)
      const accuracyMeters = Math.max(
        20,
        Math.round(
          distanceBetween(
            point(result.geometry.viewport.northeast),
            point(result.geometry.viewport.southwest),
          ) / 2,
        ),
      )
      if (accuracyMeters > 1000) throw new ResearchError("location_not_found")
      return { name: query.trim(), area: "", coordinates, accuracyMeters }
    },
    /** Fetch up to twelve historical or civic candidates with an exact field mask; never fetch reviews/photos. */
    async nearby(location, radiusMeters) {
      const response = await fetchProvider(
        "https://places.googleapis.com/v1/places:searchNearby",
        {
          method: "POST",
          headers: {
            "X-Goog-Api-Key": key,
            "X-Goog-FieldMask": "places.id,places.displayName,places.location",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            maxResultCount: 12,
            rankPreference: "DISTANCE",
            includedTypes: [
              "historical_landmark",
              "monument",
              "museum",
              "church",
              "cemetery",
              "tourist_attraction",
              "park",
              "concert_hall",
              "performing_arts_theater",
              "art_gallery",
              "library",
            ],
            locationRestriction: {
              circle: {
                center: { latitude: location.coordinates.lat, longitude: location.coordinates.lon },
                radius: radiusMeters,
              },
            },
          }),
        },
        transport,
      )
      const data = decode(Nearby, await readProviderJson(response), "malformed")
      return (data.places ?? []).map(place => ({
        id: place.id,
        name: place.displayName.text,
        coordinates: decode(
          Coordinates,
          { lat: place.location.latitude, lon: place.location.longitude },
          "malformed",
        ),
      }))
    },
    /** Proxy a whole image, retaining the embedded Google logo and attribution. */
    async map(center, markers, radiusMeters) {
      const extent = markers.length
        ? Math.max(75, ...markers.map(marker => distanceBetween(center, marker) * 1.15))
        : radiusMeters / 2
      const zoom = Math.max(
        0,
        Math.min(
          20,
          Math.floor(
            Math.log2(
              (156543.03392 *
                Math.cos((Math.min(85, Math.abs(center.lat)) * Math.PI) / 180) *
                190) /
                (extent * 2),
            ),
          ),
        ),
      )
      const url = new URL("https://maps.googleapis.com/maps/api/staticmap")
      url.search = new URLSearchParams({
        key,
        center: `${center.lat},${center.lon}`,
        zoom: String(zoom),
        size: "640x240",
        scale: "2",
        maptype: "roadmap",
        format: "png",
        style: "feature:all|saturation:-100",
      }).toString()
      markers.forEach((marker, index) =>
        url.searchParams.append(
          "markers",
          `color:red|label:${index + 1}|${marker.lat},${marker.lon}`,
        ),
      )
      const response = await fetchProvider(url, {}, transport)
      if (!response.ok || !response.headers.get("content-type")?.startsWith("image/png"))
        throw new ResearchError("unavailable")
      const bytes = await readBoundedBody(response, 2_000_000, "malformed")
      return bytes.buffer as ArrayBuffer
    },
  }
}

/** Convert Google latitude/longitude names while enforcing earth bounds. */
function point(value: { readonly lat: number; readonly lng: number }) {
  return decode(Coordinates, { lat: value.lat, lon: value.lng }, "malformed")
}

const GooglePoint = Schema.Struct({ lat: Schema.Number, lng: Schema.Number })
const Geocoding = Schema.Struct({
  status: Schema.String,
  results: Schema.Array(
    Schema.Struct({
      partial_match: Schema.optional(Schema.Boolean),
      geometry: Schema.Struct({
        location: GooglePoint,
        viewport: Schema.Struct({ northeast: GooglePoint, southwest: GooglePoint }),
      }),
    }),
  ),
})
const Nearby = Schema.Struct({
  places: Schema.optional(
    Schema.Array(
      Schema.Struct({
        id: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(300)),
        displayName: Schema.Struct({
          text: Schema.String.pipe(Schema.maxLength(300)),
          languageCode: Schema.optional(Schema.String),
        }),
        location: Schema.Struct({ latitude: Schema.Number, longitude: Schema.Number }),
      }),
    ).pipe(Schema.maxItems(12)),
  ),
})
