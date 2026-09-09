import { Schema } from "effect"
import { Coordinates } from "../src/research/Coordinates.ts"
import { distanceBetween } from "../src/lib/distanceBetween.ts"
import { decode } from "./decode.ts"
import { fetchProvider } from "./fetchProvider.ts"
import { readBoundedBody } from "./readBoundedBody.ts"
import { readProviderJson } from "./readProviderJson.ts"
import { ResearchError } from "./ResearchError.ts"

/** Return an attributed map of an actual Google walking route, keeping its key private. */
export async function handleWalkingRequest(
  /** Coordinates arrive only in a bounded POST body. */
  request: Request,
  /** Private Google credential. */
  key = process.env.GOOGLE_MAPS_API_KEY ?? "",
  /** Injectable provider transport. */
  transport: typeof fetch = fetch,
) {
  const headers = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" }
  if (request.method !== "POST")
    return new Response(null, { status: 405, headers: { ...headers, Allow: "POST" } })
  try {
    if (
      new URL(request.url).search ||
      !request.headers.get("content-type")?.startsWith("application/json")
    )
      throw new ResearchError("invalid")
    let input: unknown
    try {
      input = JSON.parse(new TextDecoder().decode(await readBoundedBody(request, 4096, "invalid")))
    } catch {
      throw new ResearchError("invalid")
    }
    const { origin, destination, number } = decode(
      Schema.Struct({
        origin: Coordinates,
        destination: Coordinates,
        number: Schema.optional(Schema.Number.pipe(Schema.int(), Schema.between(1, 3))),
      }),
      input,
    )
    if (distanceBetween(origin, destination) > 50_000) throw new ResearchError("invalid")
    if (!key) throw new ResearchError("auth")
    const response = await fetchProvider(
      "https://routes.googleapis.com/directions/v2:computeRoutes",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Goog-Api-Key": key,
          "X-Goog-FieldMask":
            "routes.duration,routes.distanceMeters,routes.polyline.encodedPolyline",
        },
        body: JSON.stringify({
          origin: waypoint(origin),
          destination: waypoint(destination),
          travelMode: "WALK",
        }),
      },
      transport,
    )
    const data = decode(Routes, await readProviderJson(response), "malformed")
    const route = data.routes?.[0]
    if (!route) throw new ResearchError("unavailable")
    const url = new URL("https://maps.googleapis.com/maps/api/staticmap")
    url.search = new URLSearchParams({
      key,
      size: "640x300",
      scale: "2",
      format: "png",
      style: "feature:all|saturation:-100",
      path: `color:0xb91c1cff|weight:3|enc:${route.polyline.encodedPolyline}`,
    }).toString()
    url.searchParams.append("markers", `color:red|size:tiny|${origin.lat},${origin.lon}`)
    url.searchParams.append(
      "markers",
      `color:red|label:${number ?? 1}|${destination.lat},${destination.lon}`,
    )
    if (url.href.length > 16_384) throw new ResearchError("unavailable")
    const map = await fetchProvider(url, {}, transport)
    if (!map.ok || !map.headers.get("content-type")?.startsWith("image/png"))
      throw new ResearchError("malformed")
    const image = await readBoundedBody(map, 2_000_000, "malformed")
    return new Response(image.buffer as ArrayBuffer, {
      headers: {
        ...headers,
        "Content-Type": "image/png",
        "X-Walk-Meters": String(route.distanceMeters ?? 0),
        "X-Walk-Seconds": String(parseFloat(route.duration)),
      },
    })
  } catch (error) {
    const invalid = error instanceof ResearchError && error.code === "invalid"
    return Response.json(
      {
        error: invalid
          ? "Choose a nearby starting point for walking directions."
          : "Walking route unavailable. Try opening directions in Google Maps.",
      },
      { status: invalid ? 400 : 502, headers },
    )
  }
}

/** Encode known coordinates as a Routes waypoint. */
function waypoint(
  /** Geographic endpoint. */
  point: Coordinates,
) {
  return { location: { latLng: { latitude: point.lat, longitude: point.lon } } }
}

const Routes = Schema.Struct({
  routes: Schema.optional(
    Schema.Array(
      Schema.Struct({
        distanceMeters: Schema.optional(Schema.Number.pipe(Schema.between(0, 200_000))),
        duration: Schema.String.pipe(Schema.pattern(/^\d+(\.\d+)?s$/)),
        polyline: Schema.Struct({
          encodedPolyline: Schema.String.pipe(Schema.minLength(1), Schema.maxLength(10_000)),
        }),
      }),
    ),
  ),
})
