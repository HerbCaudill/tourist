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
  /** Share transport and provider status handling for typed origins and story sites. */
  async function geocode(query: string) {
    const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
    url.search = new URLSearchParams({ address: query, key }).toString()
    const response = await fetchProvider(url, {}, transport)
    const data = Schema.decodeUnknownOption(Geocoding)(await readProviderJson(response))
    if (data._tag === "None") throw new ResearchError("malformed")
    if (data.value.status === "ZERO_RESULTS") return null
    if (data.value.status === "REQUEST_DENIED") throw new ResearchError("auth")
    if (data.value.status === "OVER_QUERY_LIMIT") throw new ResearchError("busy")
    if (data.value.status !== "OK") throw new ResearchError("unavailable")
    const result = data.value.results[0]
    return result && !result.partial_match ? result : null
  }
  return {
    /** Resolve a GPS position to a street or place description without exposing coordinates to the model. */
    async describeLocation(coordinates) {
      const url = new URL("https://maps.googleapis.com/maps/api/geocode/json")
      url.search = new URLSearchParams({
        latlng: `${coordinates.lat},${coordinates.lon}`,
        key,
      }).toString()
      const response = await fetchProvider(url, {}, transport)
      const data = decode(
        Schema.Struct({
          status: Schema.String,
          results: Schema.Array(Schema.Struct({ formatted_address: Schema.String })),
        }),
        await readProviderJson(response),
        "malformed",
      )
      if (data.status === "REQUEST_DENIED") throw new ResearchError("auth")
      if (data.status === "OVER_QUERY_LIMIT") throw new ResearchError("busy")
      if (data.status !== "OK" || !data.results[0]) throw new ResearchError("location_not_found")
      return data.results[0].formatted_address
    },
    /** Preserve the user's query as the label and use provider geometry only. */
    async resolve(query) {
      const result = await geocode(query)
      if (!result) throw new ResearchError("location_not_found")
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
    /** Accept identifiable sites, never a whole street or neighborhood as a story pin. */
    async resolveStory(query) {
      const result = await geocode(query)
      if (
        !result ||
        !result.place_id ||
        !result.types?.some(type =>
          [
            "street_address",
            "premise",
            "subpremise",
            "intersection",
            "point_of_interest",
            "establishment",
          ].includes(type),
        )
      )
        return null
      return { id: result.place_id, coordinates: point(result.geometry.location) }
    },
    /** Prioritize landmarks, then fill twelve distinct orientation clues from broader surroundings. */
    async nearby(location, radiusMeters) {
      /** Fetch one category set independently so either search can provide useful context. */
      async function search(includedTypes: readonly string[]) {
        const response = await fetchProvider(
          "https://places.googleapis.com/v1/places:searchNearby",
          {
            method: "POST",
            headers: {
              "X-Goog-Api-Key": key,
              "X-Goog-FieldMask":
                "places.id,places.displayName,places.formattedAddress,places.location",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              maxResultCount: 12,
              includedTypes,
              rankPreference: "DISTANCE",
              locationRestriction: {
                circle: {
                  center: {
                    latitude: location.coordinates.lat,
                    longitude: location.coordinates.lon,
                  },
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
          ...(place.formattedAddress ? { address: place.formattedAddress } : {}),
          coordinates: decode(
            Coordinates,
            { lat: place.location.latitude, lon: place.location.longitude },
            "malformed",
          ),
        }))
      }
      const [landmarks, surroundings] = await Promise.allSettled([
        search(LANDMARK_TYPES),
        search(SURROUNDING_TYPES),
      ])
      if (landmarks.status === "rejected" && surroundings.status === "rejected")
        throw landmarks.reason
      const prioritized = [
        ...(landmarks.status === "fulfilled" ? landmarks.value : []),
        ...(surroundings.status === "fulfilled" ? surroundings.value : []),
      ]
      const seen = new Set<string>()
      return prioritized
        .filter(place => {
          if (
            seen.has(place.id) ||
            distanceBetween(location.coordinates, place.coordinates) > radiusMeters
          )
            return false
          seen.add(place.id)
          return true
        })
        .slice(0, 12)
        .sort(
          (a, b) =>
            distanceBetween(location.coordinates, a.coordinates) -
            distanceBetween(location.coordinates, b.coordinates),
        )
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
                370) /
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
        size: "640x420",
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

/** Recognizable places take precedence over nearer everyday businesses. */
const LANDMARK_TYPES = [
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
]
/** Broader context fills gaps without making lodging or generic services eligible. */
const SURROUNDING_TYPES = [
  ...LANDMARK_TYPES,
  "historical_place",
  "cultural_landmark",
  "sculpture",
  "plaza",
  "garden",
  "university",
  "school",
  "community_center",
  "government_office",
  "post_office",
  "restaurant",
  "cafe",
  "coffee_shop",
  "pub",
  "bar",
  "book_store",
  "store",
  "supermarket",
]

const GooglePoint = Schema.Struct({ lat: Schema.Number, lng: Schema.Number })
const Geocoding = Schema.Struct({
  status: Schema.String,
  results: Schema.Array(
    Schema.Struct({
      place_id: Schema.optional(Schema.String.pipe(Schema.minLength(1), Schema.maxLength(300))),
      types: Schema.optional(Schema.Array(Schema.String)),
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
        formattedAddress: Schema.optional(Schema.String.pipe(Schema.maxLength(1000))),
        displayName: Schema.Struct({
          text: Schema.String.pipe(Schema.maxLength(300)),
          languageCode: Schema.optional(Schema.String),
        }),
        location: Schema.Struct({ latitude: Schema.Number, longitude: Schema.Number }),
      }),
    ).pipe(Schema.maxItems(12)),
  ),
})
